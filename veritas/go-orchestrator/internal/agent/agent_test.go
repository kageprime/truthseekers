package agent

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"
)

// scriptedLLM is a fake LLMCaller that returns canned LLMResponses in order.
// Calling it more times than scripted panics, so tests fail loudly on runaway
// loops instead of hanging. It also records the toolDefs it was called with so
// tests can assert that finalize() suppresses tools.
type scriptedLLM struct {
	mu       sync.Mutex
	calls    int
	scripts  []LLMResponse
	toolDefs [][]ToolDefinition // toolDefs seen per call
}

func (s *scriptedLLM) call(_ []Message, _, _ string, _ float64, defs []ToolDefinition, _ func(AgentEvent)) (LLMResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.calls >= len(s.scripts) {
		panic("scriptedLLM: exhausted")
	}
	resp := s.scripts[s.calls]
	s.toolDefs = append(s.toolDefs, defs)
	s.calls++
	return resp, nil
}

func newAgentForTest(t *testing.T, scripts []LLMResponse, tools map[string]ToolExecutor, maxIter int) (*Agent, *scriptedLLM) {
	t.Helper()
	sl := &scriptedLLM{scripts: scripts}
	var ats []AgentTool
	for name, exec := range tools {
		ats = append(ats, AgentTool{
			Definition: ToolDefinition{Type: "function", Function: ToolFunctionDef{Name: name, Parameters: json.RawMessage(`{"type":"object"}`)}},
			Execute:    exec,
		})
	}
	a := NewAgent(AgentConfig{Tools: ats, MaxIterations: maxIter})
	a.llmCall = sl.call
	return a, sl
}

// countingExecutor returns a fixed result and records how many times it ran.
func countingExecutor(result string) (ToolExecutor, *int32) {
	var n int32
	var mu sync.Mutex
	return func(_ json.RawMessage) (ToolResult, error) {
			mu.Lock()
			n++
			mu.Unlock()
			return ToolResult{Result: result}, nil
		}, &n
}

func tc(name, args string) ToolCall {
	return ToolCall{ID: name, Type: "function", Function: ToolCallFunc{Name: name, Arguments: args}}
}

// 1. Natural termination: text on the first iteration returns that text.
func TestRun_NaturalTermination(t *testing.T) {
	a, _ := newAgentForTest(t, []LLMResponse{
		{Text: "Hello there"},
	}, nil, 0)

	res, err := a.Run("hi")
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if res.Text != "Hello there" {
		t.Fatalf("got %q, want %q", res.Text, "Hello there")
	}
	if res.IterationCount != 1 {
		t.Fatalf("iterations=%d, want 1", res.IterationCount)
	}
}

// 2. Cap exhaustion invokes finalize(), returns its text (NOT "Response
// generated."), and the finalize nudge must NOT appear in result.Messages.
func TestRun_BudgetExhaustionTriggersFinalize(t *testing.T) {
	var toolExecs = map[string]ToolExecutor{
		"probe": func(_ json.RawMessage) (ToolResult, error) { return ToolResult{Result: "data"}, nil },
	}
	// Two tool-calling rounds, then a finalize answer. MaxIterations=2 so the
	// loop exhausts its budget before producing a final answer itself.
	scripts := []LLMResponse{
		{ToolCalls: []ToolCall{tc("probe", `{"q":1}`)}},
		{ToolCalls: []ToolCall{tc("probe", `{"q":2}`)}},
		{Text: "FINAL ANSWER"}, // finalize pass
	}
	a, sl := newAgentForTest(t, scripts, toolExecs, 2)

	res, err := a.Run("go")
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if res.Text != "FINAL ANSWER" {
		t.Fatalf("got %q, want finalize text %q", res.Text, "FINAL ANSWER")
	}
	// Finalize call must have been made with NO tool defs.
	if len(sl.toolDefs) != 3 {
		t.Fatalf("expected 3 LLM calls, got %d", len(sl.toolDefs))
	}
	if len(sl.toolDefs[2]) != 0 {
		t.Fatalf("finalize pass must omit tools, got %d defs", len(sl.toolDefs[2]))
	}
	// The finalize nudge user message must never be persisted.
	for _, m := range res.Messages {
		if strings.Contains(m.Content, "used all available tool-call steps") {
			t.Fatalf("finalize nudge leaked into result.Messages")
		}
	}
}

// 3. Abort() mid-run returns the most recent partial assistant text. We
// trigger the abort from within a tool executor (the realistic path: the stop
// route or a client disconnect sets it while a turn is executing), so the
// assistant message from iteration 1 is already appended before the loop sees
// the flag and returns.
func TestRun_AbortReturnsPartial(t *testing.T) {
	var a *Agent
	probe := func(_ json.RawMessage) (ToolResult, error) {
		a.Abort() // abort during tool execution
		return ToolResult{Result: "data"}, nil
	}
	sl := &scriptedLLM{scripts: []LLMResponse{
		{Text: "partial answer so far", ToolCalls: []ToolCall{tc("probe", `{}`)}},
		{Text: "should not be reached"},
	}}
	a = NewAgent(AgentConfig{
		Tools: []AgentTool{{
			Definition: ToolDefinition{Type: "function", Function: ToolFunctionDef{Name: "probe", Parameters: json.RawMessage(`{"type":"object"}`)}},
			Execute:    probe,
		}},
		MaxIterations: 5,
	})
	a.llmCall = sl.call

	res, err := a.Run("go")
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if res.Text != "partial answer so far" {
		t.Fatalf("got %q, want partial", res.Text)
	}
}

// 4. Two tool calls in one turn both fire; results appear in original order
// and exactly two tool_result events are emitted in order.
func TestRun_ParallelToolCallsPreserveOrder(t *testing.T) {
	execA, countA := countingExecutor("A-result")
	execB, countB := countingExecutor("B-result")
	tools := map[string]ToolExecutor{"a": execA, "b": execB}

	a, _ := newAgentForTest(t, []LLMResponse{
		{ToolCalls: []ToolCall{tc("a", `{}`), tc("b", `{}`)}},
		{Text: "done"},
	}, tools, 5)

	var results []string
	a.eventSubs = append(a.eventSubs, func(ev AgentEvent) {
		if ev.Type == "tool_result" {
			d := ev.Data.(map[string]interface{})
			results = append(results, d["name"].(string))
		}
	})

	res, err := a.Run("go")
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if res.Text != "done" {
		t.Fatalf("got %q", res.Text)
	}
	if *countA != 1 || *countB != 1 {
		t.Fatalf("exec counts A=%d B=%d, want 1 each", *countA, *countB)
	}
	// Tool messages must be appended in the order the calls were issued.
	var toolMsgs []string
	for _, m := range res.Messages {
		if m.Role == RoleTool {
			toolMsgs = append(toolMsgs, m.ToolName)
		}
	}
	if len(toolMsgs) != 2 || toolMsgs[0] != "a" || toolMsgs[1] != "b" {
		t.Fatalf("tool message order = %v, want [a b]", toolMsgs)
	}
	if len(results) != 2 || results[0] != "a" || results[1] != "b" {
		t.Fatalf("tool_result events = %v, want [a b]", results)
	}
}

// 5. Identical repeat call returns the cached result; the executor runs once.
func TestRun_DuplicateCallDedup(t *testing.T) {
	exec, count := countingExecutor("once")
	a, _ := newAgentForTest(t, []LLMResponse{
		{ToolCalls: []ToolCall{tc("probe", `{"q":"same"}`)}},
		{ToolCalls: []ToolCall{tc("probe", `{"q":"same"}`)}},
		{Text: "done"},
	}, map[string]ToolExecutor{"probe": exec}, 5)

	res, err := a.Run("go")
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if *count != 1 {
		t.Fatalf("executor ran %d times, want 1 (dedup failed)", *count)
	}
	// Second tool message should be the cached copy.
	cachedSeen := false
	for _, m := range res.Messages {
		if m.Role == RoleTool && strings.Contains(m.Content, "[cached]") {
			cachedSeen = true
		}
	}
	if !cachedSeen {
		t.Fatalf("expected a [cached] tool result, none found")
	}
}

// 6. manageContext under overflow keeps every assistant-with-toolcalls paired
// with its tool messages — no orphans that would 400 on the provider.
func TestManageContext_NeverOrphansToolMessages(t *testing.T) {
	a := NewAgent(AgentConfig{})
	// Seed: protected first user message.
	a.messages = []Message{{Role: RoleUser, Content: "seed"}}

	// Build several complete assistant(tool_calls) + tool-message units.
	for i := 0; i < 5; i++ {
		callID := "call-0"
		if i > 0 {
			callID = "call-x"
		}
		a.messages = append(a.messages,
			Message{Role: RoleAssistant, Content: "", ToolCalls: []ToolCall{{ID: callID, Type: "function", Function: ToolCallFunc{Name: "probe", Arguments: `{}`}}}},
			Message{Role: RoleTool, Content: strings.Repeat("x", 500), ToolCallID: callID, ToolName: "probe"},
		)
	}

	// Tiny budget to force aggressive trimming.
	a.manageContext(200)

	if err := assertNoOrphanedToolCalls(a.messages); err != "" {
		t.Fatalf(err)
	}
	// Seed must survive.
	if len(a.messages) == 0 || a.messages[0].Content != "seed" {
		t.Fatalf("seed message was dropped")
	}
}

// assertNoOrphanedToolCalls returns an error message if any assistant message
// carrying tool_calls is not immediately followed by a tool message for each
// call id; "" means the conversation is contract-valid.
func assertNoOrphanedToolCalls(msgs []Message) string {
	for i, m := range msgs {
		if len(m.ToolCalls) == 0 {
			continue
		}
		// Collect the ids this assistant expects answers for.
		want := map[string]bool{}
		for _, tc := range m.ToolCalls {
			want[tc.ID] = true
		}
		// Walk forward collecting matching tool messages.
		for j := i + 1; j < len(msgs) && len(want) > 0; j++ {
			if msgs[j].Role == RoleTool && want[msgs[j].ToolCallID] {
				delete(want, msgs[j].ToolCallID)
			}
			// Stop scanning past the next assistant message.
			if msgs[j].Role == RoleAssistant {
				break
			}
		}
		if len(want) > 0 {
			return "orphaned tool_calls without matching tool messages: " + strings.Join(keys(want), ",")
		}
	}
	return ""
}

func keys(m map[string]bool) []string {
	var ks []string
	for k := range m {
		ks = append(ks, k)
	}
	return ks
}
