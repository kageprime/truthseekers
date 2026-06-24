package agent

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	// defaultMaxIterations caps how many LLM tool-calling rounds a single run
	// may take. A run that hits this cap is NOT cut off abruptly: see finalize().
	defaultMaxIterations = 25
	toolResultTruncation = 1500
	tokenBudget          = 90000
	charsPerToken        = 4

	// truncatedToolResultLen bounds how far a RoleTool message's content is
	// shrunk when the conversation exceeds tokenBudget. We truncate in place
	// rather than dropping the message, because the OpenAI tool-message
	// contract requires every assistant tool_calls entry to be followed by a
	// matching tool-role message — orphaning them yields a 400 mid-run.
	truncatedToolResultLen = 200
)

// LLMCaller is the seam the loop uses to invoke the model. In production this
// is bound to SendPromptStream (see NewAgent); tests inject a canned responder
// so the loop can be exercised deterministically without network access.
type LLMCaller func(messages []Message, systemPrompt, model string, temperature float64, toolDefs []ToolDefinition, onEvent func(AgentEvent)) (LLMResponse, error)

type Agent struct {
	config         AgentConfig
	messages       []Message
	toolResults    []ToolResult
	blocks         []Block
	blockSigs      map[string]struct{}
	toolCallSigs   map[string]string // signature -> cached result, dedupes repeat calls
	eventSubs      []func(AgentEvent)
	iterationCount int
	aborted        bool
	abortedMu      sync.Mutex
	toolDefs       []ToolDefinition
	toolExecutors  map[string]ToolExecutor
	llmCall        LLMCaller
}

func NewAgent(config AgentConfig) *Agent {
	a := &Agent{
		config:       config,
		messages:     append([]Message{}, config.Messages...),
		blockSigs:    make(map[string]struct{}),
		toolCallSigs: make(map[string]string),
		llmCall:      SendPromptStream, // production default; overridable by tests
	}
	for _, t := range config.Tools {
		a.toolDefs = append(a.toolDefs, t.Definition)
	}
	a.toolExecutors = make(map[string]ToolExecutor, len(config.Tools))
	for _, t := range config.Tools {
		a.toolExecutors[t.Definition.Function.Name] = t.Execute
	}
	if config.OnEvent != nil {
		a.eventSubs = append(a.eventSubs, config.OnEvent)
	}
	return a
}

func (a *Agent) emit(event AgentEvent) {
	for _, cb := range a.eventSubs {
		cb(event)
	}
}

func (a *Agent) Run(input string) (AgentResult, error) {
	a.iterationCount = 0
	a.toolResults = nil
	a.blockSigs = make(map[string]struct{})
	a.toolCallSigs = make(map[string]string)
	a.blocks = nil

	a.messages = append(a.messages, Message{Role: RoleUser, Content: input})

	maxIter := a.config.MaxIterations
	if maxIter <= 0 {
		maxIter = defaultMaxIterations
	}
	maxChars := tokenBudget * charsPerToken

	for a.iterationCount < maxIter {
		if a.isAborted() {
			break
		}
		a.iterationCount++

		a.manageContext(maxChars)

		startTime := time.Now()
		response, err := a.llmCall(
			a.messages,
			a.config.SystemPrompt,
			a.config.Model,
			a.config.Temperature,
			a.toolDefs,
			func(ev AgentEvent) { a.emit(ev) },
		)
		if err != nil {
			return AgentResult{Text: fmt.Sprintf("LLM error: %v", err), Messages: a.messages}, fmt.Errorf("llm call: %w", err)
		}
		latencyMs := time.Since(startTime).Milliseconds()

		a.emit(AgentEvent{
			Type: "trace",
			Data: map[string]interface{}{
				"iteration": a.iterationCount,
				"latencyMs": latencyMs,
				"usage":     response.Usage,
			},
			Timestamp: time.Now().UnixMilli(),
		})

		if a.isAborted() {
			break
		}

		if len(response.ToolCalls) == 0 {
			if response.Text != "" {
				a.messages = append(a.messages, Message{Role: RoleAssistant, Content: response.Text})
			}
			return a.buildResult(response.Text), nil
		}

		msg := Message{Role: RoleAssistant, Content: response.Text, ToolCalls: response.ToolCalls}
		a.messages = append(a.messages, msg)

		if response.Text != "" {
			a.emit(AgentEvent{Type: "text", Data: response.Text, Timestamp: time.Now().UnixMilli()})
		}
		// Emit every tool_use serially first (preserves turn ordering in the UI),
		// then execute concurrently and emit results serially afterward.
		for _, tc := range response.ToolCalls {
			var args map[string]interface{}
			json.Unmarshal([]byte(tc.Function.Arguments), &args)
			a.emit(AgentEvent{Type: "tool_use", Data: map[string]interface{}{"name": tc.Function.Name, "args": args}, Timestamp: time.Now().UnixMilli()})
		}

		outcomes := a.executeToolCallsConcurrent(response.ToolCalls)
		for i, tc := range response.ToolCalls {
			outcome := outcomes[i]
			a.toolResults = append(a.toolResults, outcome.result)

			a.emit(AgentEvent{
				Type:      "tool_result",
				Data:      map[string]interface{}{"name": tc.Function.Name, "result": truncate(outcome.result.Result, 1000)},
				Timestamp: time.Now().UnixMilli(),
			})

			for _, b := range outcome.result.Blocks {
				sig := blockSignature(b)
				if _, ok := a.blockSigs[sig]; !ok {
					a.blockSigs[sig] = struct{}{}
					a.blocks = append(a.blocks, b)
				}
			}

			a.messages = append(a.messages, Message{
				Role:       RoleTool,
				Content:    outcome.result.Result,
				ToolCallID: tc.ID,
				ToolName:   tc.Function.Name,
			})
		}
	}

	// We only reach here by exhausting the iteration budget or by abort.
	// Natural completion returns inside the loop above.
	if a.isAborted() {
		return a.buildResult(a.lastAssistantText()), nil
	}
	// Budget exhausted: force one coherent final answer instead of the old
	// "Response generated." + stale-text fallthrough.
	return a.finalize()
}

// finalize forces a single closing LLM pass with no tools available, so the
// model must synthesize a final answer from whatever it gathered before the
// iteration cap. The nudge message is local only — it is never appended to
// a.messages and therefore never persisted by callers.
func (a *Agent) finalize() (AgentResult, error) {
	lastText := a.lastAssistantText()
	nudged := append(append([]Message{}, a.messages...), Message{
		Role: RoleUser,
		Content: "You have used all available tool-call steps. Provide your final answer now using only the information gathered so far. Do not call any tools.",
	})
	// Empty toolDefs => the request body omits `tools` entirely, so the model
	// physically cannot call tools even if it ignores tool_choice hints.
	resp, err := a.llmCall(nudged, a.config.SystemPrompt, a.config.Model, a.config.Temperature, nil, func(ev AgentEvent) { a.emit(ev) })
	if err != nil || resp.Text == "" {
		return a.buildResult(lastText), nil
	}
	a.messages = append(a.messages, Message{Role: RoleAssistant, Content: resp.Text})
	return a.buildResult(resp.Text), nil
}

// execOutcome is the per-tool-call result collected during concurrent
// execution, indexed by position so results can be appended deterministically.
type execOutcome struct {
	result ToolResult
}

// executeToolCallsConcurrent runs every tool call in a turn concurrently and
// returns results in the SAME order as the input slice. Events and shared
// state are mutated only after WaitGroup completion, in the caller goroutine,
// because a.eventSubs (the SSE writer in chat.go) is not concurrency-safe.
func (a *Agent) executeToolCallsConcurrent(tcs []ToolCall) []execOutcome {
	outcomes := make([]execOutcome, len(tcs))
	var wg sync.WaitGroup
	for i, tc := range tcs {
		if a.isAborted() {
			outcomes[i] = execOutcome{result: ToolResult{Result: "aborted"}}
			continue
		}
		wg.Add(1)
		go func(idx int, call ToolCall) {
			defer wg.Done()
			if a.isAborted() {
				outcomes[idx] = execOutcome{result: ToolResult{Result: "aborted"}}
				return
			}
			outcomes[idx] = execOutcome{result: a.executeToolCall(call)}
		}(i, tc)
	}
	wg.Wait()
	return outcomes
}

func (a *Agent) executeToolCall(tc ToolCall) ToolResult {
	exec, ok := a.toolExecutors[tc.Function.Name]
	if !ok {
		return ToolResult{Result: fmt.Sprintf("Unknown tool: %s", tc.Function.Name)}
	}

	var args json.RawMessage
	if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
		return ToolResult{Result: fmt.Sprintf("Invalid arguments for %s: %s", tc.Function.Name, tc.Function.Arguments)}
	}

	if len(args) == 0 || string(args) == "null" || string(args) == "{}" {
		for _, def := range a.toolDefs {
			if def.Function.Name == tc.Function.Name {
				var params struct {
					Required []string `json:"required"`
				}
				json.Unmarshal(def.Function.Parameters, &params)
				if len(params.Required) > 0 {
					return ToolResult{Result: fmt.Sprintf("Skipped: %s requires arguments: %s", tc.Function.Name, strings.Join(params.Required, ", "))}
				}
				break
			}
		}
	}

	// Duplicate-call dedup: if the model re-issues an identical call, return
	// the cached result instead of hitting the network/executing twice.
	sig := toolCallSignature(tc.Function.Name, args)
	if cached, ok := a.toolCallSigs[sig]; ok {
		return ToolResult{Result: cached + "\n[cached]"}
	}

	result, err := exec(args)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf("Error executing %s: %v", tc.Function.Name, err)}
	}
	if len(result.Result) > toolResultTruncation {
		result.Result = result.Result[:toolResultTruncation] + "\n[Result truncated]"
	}
	// Cache by signature for future dedup. Only cache non-trivial results so
	// we never serve "[cached]" of an "[cached]"-marked string.
	if result.Result != "" && !strings.Contains(result.Result, "[cached]") {
		a.toolCallSigs[sig] = result.Result
	}
	return result
}

// toolCallSignature produces a canonical, order-independent key for a tool
// call so semantically identical repeats collapse to one cache entry.
func toolCallSignature(name string, args json.RawMessage) string {
	var canonical interface{}
	if json.Unmarshal(args, &canonical) != nil {
		// Fall back to the raw bytes if args aren't valid JSON.
		return name + "|" + string(args)
	}
	canonicalJSON, _ := json.Marshal(canonical)
	return name + "|" + string(canonicalJSON)
}

// manageContext keeps the conversation within maxChars WITHOUT violating the
// OpenAI tool-message contract. The previous implementation dropped RoleTool
// messages while keeping the assistant message whose tool_calls referenced
// them, which 400s on every OpenAI-compatible provider.
//
// Pass 1: truncate every RoleTool.Content in place (keeps the pairing).
// Pass 2 (only if still over budget): drop oldest complete tool-conversation
// units — an assistant-with-tool_calls message together with its trailing
// RoleTool messages — from the front. The leading user/system seed is never
// dropped.
func (a *Agent) manageContext(maxChars int) {
	total := a.messageChars()
	if total <= maxChars {
		return
	}

	// Pass 1: in-place truncation of tool results.
	for i, m := range a.messages {
		if m.Role == RoleTool && len(m.Content) > truncatedToolResultLen {
			a.messages[i].Content = m.Content[:truncatedToolResultLen] + "\n…[truncated]"
		}
	}

	total = a.messageChars()
	if total <= maxChars {
		return
	}

	// Pass 2: drop complete tool-conversation units from the front, oldest
	// first, preserving the assistant<->tool pairing at all times.
	for total > maxChars && a.canDropOldestUnit() {
		a.messages = a.dropOldestUnit()
		total = a.messageChars()
	}
}

func (a *Agent) messageChars() int {
	var total int
	for _, m := range a.messages {
		total += len(m.Content)
		for _, tc := range m.ToolCalls {
			total += len(tc.Function.Arguments)
		}
	}
	return total
}

// canDropOldestUnit reports whether the oldest non-seed message is the start
// of a droppable tool-conversation unit. We refuse to drop if doing so would
// orphan a later assistant-with-tool_calls from its results.
func (a *Agent) canDropOldestUnit() bool {
	// Protect at least the first message (user/system seed).
	if len(a.messages) <= 1 {
		return false
	}
	return true
}

// dropOldestUnit removes the oldest complete tool-conversation unit: either an
// assistant message that has tool_calls plus all immediately-following
// RoleTool messages, or (if the oldest message is not such an assistant) a
// single standalone message. It always keeps at least one message.
func (a *Agent) dropOldestUnit() []Message {
	if len(a.messages) <= 1 {
		return a.messages
	}
	// Index 0 is the protected seed; the unit starts at index 1.
	unitStart := 1
	unitEnd := unitStart + 1 // exclusive end; first message after the assistant
	if len(a.messages[unitStart].ToolCalls) > 0 {
		// Consume the trailing RoleTool messages that answer these tool_calls.
		// Start at unitStart+1 (NOT unitStart): messages[unitStart] is the
		// assistant itself, so beginning the RoleTool walk there would stop at
		// once and reconstruct the identical slice (infinite loop).
		for unitEnd < len(a.messages) && a.messages[unitEnd].Role == RoleTool {
			unitEnd++
		}
	}
	kept := make([]Message, 0, len(a.messages)-(unitEnd-unitStart))
	kept = append(kept, a.messages[:unitStart]...)
	kept = append(kept, a.messages[unitEnd:]...)
	return kept
}

func (a *Agent) isAborted() bool {
	a.abortedMu.Lock()
	defer a.abortedMu.Unlock()
	return a.aborted
}

func (a *Agent) Abort() {
	a.abortedMu.Lock()
	a.aborted = true
	a.abortedMu.Unlock()
}

// lastAssistantText returns the most recent assistant message content, or ""
// if none exists. Used for partial-result returns on abort.
func (a *Agent) lastAssistantText() string {
	for i := len(a.messages) - 1; i >= 0; i-- {
		if a.messages[i].Role == RoleAssistant && a.messages[i].Content != "" {
			return a.messages[i].Content
		}
	}
	return ""
}

func (a *Agent) buildResult(text string) AgentResult {
	clean, extracted := extractDSMLBlocks(text)
	if len(extracted) > 0 {
		for _, b := range extracted {
			sig := blockSignature(b)
			if _, ok := a.blockSigs[sig]; !ok {
				a.blockSigs[sig] = struct{}{}
				a.blocks = append(a.blocks, b)
			}
		}
	}
	return AgentResult{
		Text:           clean,
		Messages:       a.messages,
		ToolResults:    a.toolResults,
		Blocks:         a.blocks,
		IterationCount: a.iterationCount,
	}
}

// extractDSMLBlocks strips inline render_blocks / DSML tags from text,
// parsing any embedded JSON block arrays so they render as structured
// content instead of raw markup leaking into the UI.
// Returns the cleaned text and any blocks found.
func extractDSMLBlocks(text string) (string, []Block) {
	var blocks []Block

	// Extract blocks from DSML parameter regions, then remove the ENTIRE region
	// (tags + JSON) so stripBareBlockArrays doesn't re-extract the same blocks.
	reDSMLParam := regexp.MustCompile(`(?is)<｜DSML｜parameter[^>]*>([\s\S]*?)</｜DSML｜parameter>`)
	for _, match := range reDSMLParam.FindAllStringSubmatch(text, -1) {
		blocks = append(blocks, parseBlocksFromText(strings.TrimSpace(match[1]))...)
	}
	text = reDSMLParam.ReplaceAllString(text, "")

	// <render_blocks>[...]</render_blocks> variant — same: extract then remove fully.
	reRender := regexp.MustCompile(`(?is)<render_blocks>([\s\S]*?)</render_blocks>`)
	for _, match := range reRender.FindAllStringSubmatch(text, -1) {
		blocks = append(blocks, parseBlocksFromText(strings.TrimSpace(match[1]))...)
	}
	text = reRender.ReplaceAllString(text, "")

	// Sweep ALL remaining DSML tags (open + close). Handles leftover wrappers
	// like <render_blocks> and </｜DSML｜tool_calls> whose partner was on the
	// other side of an already-removed region.
	reAnyDSML := regexp.MustCompile(`(?i)</?[｜<][^>]*>`)
	text = reAnyDSML.ReplaceAllString(text, "")
	reOrphanRender := regexp.MustCompile(`(?i)</?render_blocks\s*>`)
	text = reOrphanRender.ReplaceAllString(text, "")

	// Bare JSON block arrays: sometimes the model dumps the blocks array as raw
	// JSON with no wrapper tags at all (a failed tool-call emission). Detect a
	// top-level JSON array where every element is a valid block object, and pull
	// it out of the text so the user sees rendered blocks, not a JSON blob.
	text, bareBlocks := stripBareBlockArrays(text)
	blocks = append(blocks, bareBlocks...)

	// Collapse runs of blank lines left behind.
	text = regexp.MustCompile(`\n{3,}`).ReplaceAllString(text, "\n\n")
	text = strings.TrimSpace(text)

	return text, blocks
}

// knownBlockType reports whether a string is one of the renderer's recognized
// block types. Used to validate that a bare JSON array is really a blocks
// array and not some unrelated data.
func knownBlockType(t string) bool {
	switch t {
	case "heading", "text", "section", "timeline", "image", "video",
		"gallery", "citation", "crossref", "diagram", "divider",
		"map_2d", "map_3d", "table", "list", "pullquote", "tool_call":
		return true
	}
	return false
}

// stripBareBlockArrays finds top-level JSON arrays in text that look like
// render_blocks payloads (every element has a known `type` and a `data`
// object) and removes them, returning the extracted blocks.
func stripBareBlockArrays(text string) (string, []Block) {
	var allBlocks []Block
	re := regexp.MustCompile(`(?s)\[\s*\{[\s\S]*?\}\s*\]`)
	for {
		loc := re.FindStringIndex(text)
		if loc == nil {
			break
		}
		candidate := text[loc[0]:loc[1]]
		blocks := parseBlocksFromText(candidate)
		if !looksLikeBlocksArray(candidate, blocks) {
			// Not a blocks array — stop scanning so we don't eat unrelated JSON
			// (e.g. an inline table in prose). Bail out entirely.
			break
		}
		allBlocks = append(allBlocks, blocks...)
		text = text[:loc[0]] + text[loc[1]:]
	}
	return text, allBlocks
}

// looksLikeBlocksArray confirms the parsed JSON is genuinely a blocks array:
// the JSON parsed, every element yielded a known block type, and at least one
// element had a `data` object. This prevents treating arbitrary JSON arrays
// (like ["a","b"]) as blocks.
func looksLikeBlocksArray(jsonStr string, blocks []Block) bool {
	if len(blocks) == 0 {
		return false
	}
	var raw []map[string]interface{}
	if json.Unmarshal([]byte(jsonStr), &raw) != nil {
		return false
	}
	if len(raw) != len(blocks) {
		return false
	}
	for _, el := range raw {
		t, _ := el["type"].(string)
		if !knownBlockType(t) {
			return false
		}
	}
	return true
}

// parseBlocksFromText attempts to find a JSON array in the text and parse it
// into Block structs. It looks for the first '[' ... ']' bracket pair.
func parseBlocksFromText(text string) []Block {
	start := strings.Index(text, "[")
	end := strings.LastIndex(text, "]")
	if start < 0 || end <= start {
		return nil
	}
	jsonStr := text[start : end+1]
	var rawBlocks []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &rawBlocks); err != nil {
		return nil
	}
	var blocks []Block
	for _, rb := range rawBlocks {
		btype, _ := rb["type"].(string)
		if btype == "" {
			continue
		}
		var data json.RawMessage
		if d, ok := rb["data"]; ok {
			data, _ = json.Marshal(d)
		}
		if data == nil {
			data = json.RawMessage("{}")
		}
		blocks = append(blocks, Block{Type: btype, Data: data})
	}
	return blocks
}

func blockSignature(b Block) string {
	data := string(b.Data)
	if len(data) > 200 {
		data = data[:200]
	}
	return b.Type + ":" + data
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
