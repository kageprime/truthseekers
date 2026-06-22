package agent

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	defaultMaxIterations = 15
	toolResultTruncation = 1500
	tokenBudget          = 90000
	charsPerToken        = 4
)

type Agent struct {
	config         AgentConfig
	messages       []Message
	toolResults    []ToolResult
	blocks         []Block
	blockSigs      map[string]struct{}
	eventSubs      []func(AgentEvent)
	iterationCount int
	aborted        bool
	toolDefs       []ToolDefinition
	toolExecutors  map[string]ToolExecutor
}

func NewAgent(config AgentConfig) *Agent {
	a := &Agent{
		config:    config,
		messages:  append([]Message{}, config.Messages...),
		blockSigs: make(map[string]struct{}),
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
	a.blocks = nil

	a.messages = append(a.messages, Message{Role: RoleUser, Content: input})

	maxIter := a.config.MaxIterations
	if maxIter <= 0 {
		maxIter = defaultMaxIterations
	}
	maxChars := tokenBudget * charsPerToken

	for a.iterationCount < maxIter {
		if a.aborted {
			break
		}
		a.iterationCount++

		a.manageContext(maxChars)

		startTime := time.Now()
		response, err := SendPromptStream(
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

		if a.aborted {
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
		for _, tc := range response.ToolCalls {
			var args map[string]interface{}
			json.Unmarshal([]byte(tc.Function.Arguments), &args)
			a.emit(AgentEvent{Type: "tool_use", Data: map[string]interface{}{"name": tc.Function.Name, "args": args}, Timestamp: time.Now().UnixMilli()})
		}

		for _, tc := range response.ToolCalls {
			if a.aborted {
				break
			}
			result := a.executeToolCall(tc)
			a.toolResults = append(a.toolResults, result)

			a.emit(AgentEvent{
				Type: "tool_result",
				Data: map[string]interface{}{"name": tc.Function.Name, "result": truncate(result.Result, 1000)},
				Timestamp: time.Now().UnixMilli(),
			})

			for _, b := range result.Blocks {
				sig := blockSignature(b)
				if _, ok := a.blockSigs[sig]; !ok {
					a.blockSigs[sig] = struct{}{}
					a.blocks = append(a.blocks, b)
				}
			}

			a.messages = append(a.messages, Message{
				Role:       RoleTool,
				Content:    result.Result,
				ToolCallID: tc.ID,
				ToolName:   tc.Function.Name,
			})
		}
	}

	text := "Response generated."
	for i := len(a.messages) - 1; i >= 0; i-- {
		if a.messages[i].Role == RoleAssistant && a.messages[i].Content != "" {
			text = a.messages[i].Content
			break
		}
	}
	return a.buildResult(text), nil
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

	result, err := exec(args)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf("Error executing %s: %v", tc.Function.Name, err)}
	}
	if len(result.Result) > toolResultTruncation {
		result.Result = result.Result[:toolResultTruncation] + "\n[Result truncated]"
	}
	return result
}

func (a *Agent) manageContext(maxChars int) {
	var total int
	for _, m := range a.messages {
		total += len(m.Content)
		for _, tc := range m.ToolCalls {
			total += len(tc.Function.Arguments)
		}
	}
	if total <= maxChars {
		return
	}

	var summarized []Message
	for _, m := range a.messages {
		if m.Role == RoleTool {
			s := m
			if len(s.Content) > 100 {
				s.Content = s.Content[:100]
			}
			summarized = append(summarized, s)
		} else {
			summarized = append(summarized, m)
		}
	}
	a.messages = summarized

	total = 0
	for _, m := range a.messages {
		total += len(m.Content)
	}
	if total > maxChars {
		var filtered []Message
		for _, m := range a.messages {
			if m.Role == RoleTool {
				continue
			}
			filtered = append(filtered, m)
		}
		a.messages = filtered
	}
}

func (a *Agent) Abort() {
	a.aborted = true
}

func (a *Agent) buildResult(text string) AgentResult {
	return AgentResult{
		Text:           text,
		Messages:       a.messages,
		ToolResults:    a.toolResults,
		Blocks:         a.blocks,
		IterationCount: a.iterationCount,
	}
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
