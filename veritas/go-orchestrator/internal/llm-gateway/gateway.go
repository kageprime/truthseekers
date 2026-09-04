package llmgateway

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Gateway provides a unified LLM completion endpoint with model resolution,
// usage metering, and provider failover.
// KeyStore is the minimal interface the gateway needs for credential lookup.
// Implemented by credstore.Store; a nil-safe map wrapper also satisfies it.
type KeyStore interface {
	Get(service string) string
}

type Gateway struct {
	Catalog      []ModelSpec
	Meter        *Meter
	DoKey        string
	GroqKey      string
	MetaKey      string
	OpenAIKey    string
	CredStore    KeyStore
	mu           sync.RWMutex
}

// CompletionRequest mirrors the OpenAI chat completion format.
type CompletionRequest struct {
	Model       string            `json:"model"`
	Messages    []json.RawMessage `json:"messages"`
	Stream      bool              `json:"stream"`
	Temperature float64           `json:"temperature,omitempty"`
	MaxTokens   int               `json:"max_tokens,omitempty"`
	Tools       []json.RawMessage `json:"tools,omitempty"`
	ToolChoice  interface{}       `json:"tool_choice,omitempty"`
}

// HandleCompletion proxies a completion request through the appropriate
// provider, meters usage, and returns the response.
func (g *Gateway) HandleCompletion(w http.ResponseWriter, r *http.Request) {
	var req CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	// Resolve key from CredStore first, fall back to direct fields.
	doKey := g.DoKey
	groqKey := g.GroqKey
	metaKey := g.MetaKey
	if g.CredStore != nil {
		if k := g.CredStore.Get("do"); k != "" {
			doKey = k
		}
		if k := g.CredStore.Get("groq"); k != "" {
			groqKey = k
		}
		if k := g.CredStore.Get("meta"); k != "" {
			metaKey = k
		}
	}

	provider := ResolveProvider(req.Model, doKey, groqKey, metaKey)
	if provider.APIKey == "" {
		http.Error(w, `{"error":"no API key for model"}`, http.StatusServiceUnavailable)
		return
	}

	// Build the upstream request.
	upstreamBody, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/chat/completions"

	upReq, err := http.NewRequest("POST", upstreamURL, strings.NewReader(string(upstreamBody)))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}
	upReq.Header.Set("Content-Type", "application/json")
	upReq.Header.Set("Authorization", "Bearer "+provider.APIKey)

	client := &http.Client{Timeout: 300 * time.Second}

	if req.Stream {
		g.handleStreaming(w, r, upReq, client, req.Model)
	} else {
		g.handleNonStreaming(w, r, upReq, client, req.Model)
	}
}

func (g *Gateway) handleStreaming(w http.ResponseWriter, r *http.Request, upReq *http.Request, client *http.Client, model string) {
	resp, err := client.Do(upReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy headers and status from upstream.
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	if resp.StatusCode != 200 {
		io.Copy(w, resp.Body)
		return
	}

	// Stream response back, capturing usage if present.
	// ponytail: usage parsing from SSE stream is best-effort.
	var inputTokens, outputTokens int
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			w.Write(buf[:n])
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
			// Best-effort token counting from SSE data lines.
			// ponytail: rough estimate, not exact. Use upstream usage field when available.
			line := string(buf[:n])
			if strings.Contains(line, `"usage"`) {
				var usage struct {
					Usage *struct {
						InputTokens  int `json:"input"`
						OutputTokens int `json:"output"`
					} `json:"usage"`
				}
				// Try to extract from SSE data: prefix
				for _, l := range strings.Split(line, "\n") {
					if strings.HasPrefix(l, "data: ") {
						json.Unmarshal([]byte(strings.TrimPrefix(l, "data: ")), &usage)
						if usage.Usage != nil {
							inputTokens = usage.Usage.InputTokens
							outputTokens = usage.Usage.OutputTokens
						}
					}
				}
			}
		}
		if err != nil {
			break
		}
	}
	g.recordUsage(r, model, inputTokens, outputTokens)
}

func (g *Gateway) handleNonStreaming(w http.ResponseWriter, r *http.Request, upReq *http.Request, client *http.Client, model string) {
	resp, err := client.Do(upReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	w.Write(body)

	// Parse usage from response.
	if resp.StatusCode == 200 {
		var usageResp struct {
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
				TotalTokens      int `json:"total_tokens"`
			} `json:"usage"`
		}
		json.Unmarshal(body, &usageResp)
		if usageResp.Usage != nil {
			g.recordUsage(r, model, usageResp.Usage.PromptTokens, usageResp.Usage.CompletionTokens)
		}
	}
}

func (g *Gateway) recordUsage(r *http.Request, model string, inputTokens, outputTokens int) {
	if g.Meter == nil || (inputTokens == 0 && outputTokens == 0) {
		return
	}
	spec := FindModel(model, g.Catalog)
	cost := 0.0
	if spec != nil {
		cost = EstimateCost(*spec, inputTokens, outputTokens)
	}
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID = "anonymous"
	}
	g.Meter.Record(UsageRecord{
		UserID:       userID,
		Model:        model,
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
		TotalTokens:  inputTokens + outputTokens,
		Cost:         cost,
		Timestamp:    time.Now(),
	})
}

// HandleModels returns the model catalog.
func (g *Gateway) HandleModels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g.Catalog)
}

// HandleUsage returns usage stats for a user.
func (g *Gateway) HandleUsage(w http.ResponseWriter, r *http.Request) {
	if g.Meter == nil {
		w.Write([]byte(`{"totals":{}}`))
		return
	}
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		userID = r.Header.Get("X-User-ID")
	}
	if userID == "" {
		userID = "anonymous"
	}
	totals := g.Meter.GetUserTotals(userID)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"userId":    userID,
		"totals":    totals,
		"recent":    g.Meter.GetRecent(10),
	})
}

// RegisterRoutes mounts LLM gateway routes on a ServeMux.
func (g *Gateway) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/v1/llm/completions", g.HandleCompletion)
	mux.HandleFunc("/v1/llm/models", g.HandleModels)
	mux.HandleFunc("/v1/llm/usage", g.HandleUsage)
}
