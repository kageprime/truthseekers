package agent

import "encoding/json"

type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

type Message struct {
	Role       Role       `json:"role"`
	Content    string     `json:"content"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolName   string     `json:"tool_name,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function ToolCallFunc `json:"function"`
}

type ToolCallFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolDefinition struct {
	Type     string           `json:"type"`
	Function ToolFunctionDef  `json:"function"`
}

type ToolFunctionDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type ToolExecutor func(args json.RawMessage) (ToolResult, error)

type ToolResult struct {
	Result string          `json:"result"`
	Blocks []Block         `json:"blocks,omitempty"`
}

type Usage struct {
	Input        int `json:"input"`
	Output       int `json:"output"`
	CacheRead    int `json:"cacheRead"`
	CacheWrite   int `json:"cacheWrite"`
	TotalTokens  int `json:"totalTokens"`
}

type LLMResponse struct {
	Text      string     `json:"text"`
	ToolCalls []ToolCall `json:"toolCalls,omitempty"`
	Usage     *Usage     `json:"usage,omitempty"`
}

type ModelRoute struct {
	ModelID   string
	ModelName string
	BaseURL   string
	APIKey    string
	Reasoning bool
}

type AgentEvent struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

type AgentConfig struct {
	Model            string
	SystemPrompt     string
	Messages         []Message
	Tools            []AgentTool
	MaxIterations    int
	Temperature      float64
	ReasoningEffort  string
	OnEvent          func(AgentEvent)
}

type AgentTool struct {
	Definition ToolDefinition
	Execute    ToolExecutor
}

type AgentResult struct {
	Text           string       `json:"text"`
	Messages       []Message    `json:"messages"`
	ToolResults    []ToolResult `json:"toolResults"`
	Blocks         []Block      `json:"blocks"`
	IterationCount int          `json:"iterationCount"`
}

type Block struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}
