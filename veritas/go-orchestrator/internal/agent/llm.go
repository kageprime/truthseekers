package agent

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type ChatMessage struct {
	Role       string            `json:"role"`
	Content    string            `json:"content,omitempty"`
	ToolCallID string            `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCallPayload `json:"tool_calls,omitempty"`
}

type ToolCallPayload struct {
	ID       string             `json:"id,omitempty"`
	Type     string             `json:"type,omitempty"`
	Function ToolCallFuncPayload `json:"function,omitempty"`
}

type ToolCallFuncPayload struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

func toChatMessages(msgs []Message, systemPrompt string) []ChatMessage {
	var out []ChatMessage
	if systemPrompt != "" {
		out = append(out, ChatMessage{Role: "system", Content: systemPrompt})
	}
	for _, m := range msgs {
		cm := ChatMessage{Role: string(m.Role), Content: m.Content}
		if m.ToolCallID != "" {
			cm.ToolCallID = m.ToolCallID
		}
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				cm.ToolCalls = append(cm.ToolCalls, ToolCallPayload{
					ID:   tc.ID,
					Type: tc.Type,
					Function: ToolCallFuncPayload{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				})
			}
		}
		out = append(out, cm)
	}
	return out
}

type streamChoice struct {
	Index int              `json:"index"`
	Delta streamDelta      `json:"delta"`
}

type streamDelta struct {
	Role      string             `json:"role,omitempty"`
	Content   string             `json:"content,omitempty"`
	ToolCalls []streamToolCall   `json:"tool_calls,omitempty"`
}

type streamToolCall struct {
	Index    int                   `json:"index"`
	ID       string                `json:"id,omitempty"`
	Type     string                `json:"type,omitempty"`
	Function streamToolCallFunc    `json:"function,omitempty"`
}

type streamToolCallFunc struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

type streamChunk struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Model   string         `json:"model"`
	Choices []streamChoice `json:"choices"`
	Usage   *Usage         `json:"usage,omitempty"`
}

type chatReqBody struct {
	Model       string           `json:"model"`
	Messages    []ChatMessage    `json:"messages"`
	Stream      bool             `json:"stream"`
	Temperature float64          `json:"temperature,omitempty"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	ToolChoice  interface{}      `json:"tool_choice,omitempty"`
}

func resolveKey(baseURL string) string {
	if strings.Contains(baseURL, "groq.com") {
		return os.Getenv("GROQ_API_KEY")
	}
	return os.Getenv("MODEL_ACCESS_KEY")
}

func defaultRoute() ModelRoute {
	model := os.Getenv("DO_MODEL")
	if model == "" {
		model = "gemma-4-31B-it"
	}
	return resolveModel(model)
}

func resolveModel(model string) ModelRoute {
	switch model {
	case "gemma-4-31B-it":
		return ModelRoute{ModelID: model, ModelName: model, BaseURL: "https://inference.do-ai.run/v1", APIKey: os.Getenv("MODEL_ACCESS_KEY"), Reasoning: true}
	case "deepseek-4-flash":
		return ModelRoute{ModelID: model, ModelName: model, BaseURL: "https://inference.do-ai.run/v1", APIKey: os.Getenv("MODEL_ACCESS_KEY"), Reasoning: false}
	case "deepseek-v4-pro":
		return ModelRoute{ModelID: model, ModelName: model, BaseURL: "https://inference.do-ai.run/v1", APIKey: os.Getenv("MODEL_ACCESS_KEY"), Reasoning: true}
	case "llama-4-scout-17b-16e-instruct":
		return ModelRoute{ModelID: model, ModelName: model, BaseURL: "https://api.groq.com/openai/v1", APIKey: os.Getenv("GROQ_API_KEY"), Reasoning: false}
	default:
		return ModelRoute{ModelID: model, ModelName: model, BaseURL: "https://api.groq.com/openai/v1", APIKey: os.Getenv("GROQ_API_KEY"), Reasoning: false}
	}
}

const promptTimeout = 300 * time.Second

func SendPromptStream(
	messages []Message,
	systemPrompt string,
	model string,
	temperature float64,
	toolDefs []ToolDefinition,
	onEvent func(AgentEvent),
) (LLMResponse, error) {
	route := resolveModel(model)
	if route.APIKey == "" {
		return LLMResponse{}, fmt.Errorf("no API key for model %s", model)
	}

	chatMsgs := toChatMessages(messages, systemPrompt)

	body := chatReqBody{
		Model:       route.ModelID,
		Messages:    chatMsgs,
		Stream:      true,
		Temperature: temperature,
		MaxTokens:   16384,
	}
	if len(toolDefs) > 0 {
		body.Tools = toolDefs
		body.ToolChoice = "auto"
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return LLMResponse{}, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", route.BaseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return LLMResponse{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+route.APIKey)

	client := &http.Client{Timeout: promptTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return LLMResponse{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return LLMResponse{}, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	return parseStream(resp.Body, onEvent)
}

func parseStream(rd io.Reader, onEvent func(AgentEvent)) (LLMResponse, error) {
	scanner := bufio.NewScanner(rd)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var fullText string
	var toolCalls []ToolCall
	toolCallAccum := map[int]*streamToolCall{}
	var usage *Usage

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if chunk.Usage != nil {
			usage = chunk.Usage
		}

		for _, ch := range chunk.Choices {
			if ch.Delta.Content != "" {
				fullText += ch.Delta.Content
				if onEvent != nil {
					onEvent(AgentEvent{Type: "text", Data: ch.Delta.Content, Timestamp: time.Now().UnixMilli()})
				}
			}
			for _, tc := range ch.Delta.ToolCalls {
				existing, ok := toolCallAccum[tc.Index]
				if !ok {
					existing = &streamToolCall{Index: tc.Index}
					toolCallAccum[tc.Index] = existing
				}
				if tc.ID != "" {
					existing.ID = tc.ID
				}
				if tc.Type != "" {
					existing.Type = tc.Type
				}
				if tc.Function.Name != "" {
					existing.Function.Name = tc.Function.Name
				}
				if tc.Function.Arguments != "" {
					existing.Function.Arguments += tc.Function.Arguments
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return LLMResponse{}, fmt.Errorf("stream read: %w", err)
	}

	for _, tc := range toolCallAccum {
		var args map[string]interface{}
		if tc.Function.Arguments != "" {
			json.Unmarshal([]byte(tc.Function.Arguments), &args)
		}
		argsJSON, _ := json.Marshal(args)
		toolCalls = append(toolCalls, ToolCall{
			ID:   tc.ID,
			Type: "function",
			Function: ToolCallFunc{
				Name:      tc.Function.Name,
				Arguments: string(argsJSON),
			},
		})
	}

	return LLMResponse{
		Text:      fullText,
		ToolCalls: toolCalls,
		Usage:     usage,
	}, nil
}
