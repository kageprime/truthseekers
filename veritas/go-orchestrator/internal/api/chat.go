package api

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

var chatSystemPrompt = `You are Truthseekers, an AI encyclopedia agent that renders rich content inline. You MUST use render_blocks for ALL structured data — do NOT format timelines, maps, or lists as plain text/Markdown.

CRITICAL RULES:
1. Call the tool immediately. No preamble, no "I can..." or "I cannot..." text before the tool call.
2. You HAVE video generation via generate_video. Never say you lack it.
3. Never output tool plans like ["tool1", "tool2"] in text.
4. Final text response comes AFTER all tool calls. First tool call, then answer.

### render_blocks — SINGLE TOOL FOR ALL RICH CONTENT
Whenever you present structured information, call render_blocks. You can include multiple blocks of different types in a single call.
Timeline data: Use type "timeline" with events[{ year, event, description }].
Map data: Use type "map_2d" or "map_3d" with markers[{ lat, lng, title, description? }].

Also supports: heading, text, citation, crossref, gallery, diagram (mermaid code), video, divider.

### web_search — search the web
### webfetch — fetch URL content
### article_search — search existing articles
### get_article — look up article by slug
### get_map — look up map by slug
### generate_image — create AI illustration
### generate_video — generate AI video clip
### verify_citation — verify claim against source
### suggest_related — find related articles
### task — delegate parallel research to sub-agent
### create_article — queue article generation
### mem_store — remember user preferences
### mem_recall — recall user preferences`

func (s *Server) handleChatRoot(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	if userID == "" {
		reqLog(r, "chat root — unauthorized")
		http.Error(w, `{"error":"Authentication required"}`, http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case "GET":
		reqLog(r, "chat root user=%s list conversations", userID)
		convs, err := s.db.ListConversations(userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(convs)

	case "POST":
		var body struct {
			Title string `json:"title"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		if body.Title == "" {
			body.Title = "New Chat"
		}
		id := uuidV4()
		reqLog(r, "chat root user=%s create id=%s title=%q", userID, id, body.Title)
		conv, err := s.db.CreateConversation(id, body.Title, userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(conv)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleChatByID(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	if userID == "" {
		reqLog(r, "chat by id — unauthorized")
		http.Error(w, `{"error":"Authentication required"}`, http.StatusUnauthorized)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/chat/")
	if idx := strings.Index(id, "/"); idx >= 0 {
		id = id[:idx]
	}
	if id == "" || id == "undefined" {
		reqLog(r, "chat by id user=%s — invalid id", userID)
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	reqLog(r, "chat by id user=%s conv=%s %s", userID, id, r.Method)

	switch r.Method {
	case "GET":
		conv, err := s.db.GetConversation(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if conv == nil {
			http.Error(w, `{"error":"Conversation not found"}`, http.StatusNotFound)
			return
		}
		msgs, err := s.db.GetMessages(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp := map[string]interface{}{
			"id":        conv.ID,
			"title":     conv.Title,
			"userId":    conv.UserID,
			"createdAt": conv.CreatedAt,
			"updatedAt": conv.UpdatedAt,
			"messages":  msgs,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)

	case "PATCH":
		var body struct {
			Title string `json:"title"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
			http.Error(w, `{"error":"Title required"}`, http.StatusBadRequest)
			return
		}
		reqLog(r, "chat by id user=%s conv=%s update title=%q", userID, id, body.Title)
		if err := s.db.UpdateConversationTitle(id, body.Title); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true}`))

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleChatMessages(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	if userID == "" {
		reqLog(r, "chat messages — unauthorized")
		http.Error(w, `{"error":"Authentication required"}`, http.StatusUnauthorized)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/chat/")
	parts := strings.SplitN(path, "/", 2)
	convID := parts[0]

	if convID == "" || convID == "undefined" {
		reqLog(r, "chat messages user=%s — invalid conv id", userID)
		http.Error(w, `{"error":"Invalid conversation"}`, http.StatusBadRequest)
		return
	}

	reqLog(r, "chat messages user=%s conv=%s", userID, convID)

	conv, err := s.db.GetConversation(convID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if conv == nil {
		http.Error(w, `{"error":"Conversation not found"}`, http.StatusNotFound)
		return
	}

	var body struct {
		Content string `json:"content"`
		Model   string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
		http.Error(w, `{"error":"Message content required"}`, http.StatusBadRequest)
		return
	}

	model := body.Model
	if model == "" {
		model = "deepseek-4-flash"
	}

	// Load existing messages (before this new one)
	stored, _ := s.db.GetMessages(convID)
	var history []agent.Message
	for _, m := range stored {
		history = append(history, storageToAgentMsg(m))
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	rc := http.NewResponseController(w)
	w.WriteHeader(http.StatusOK)

	builtins := agent.BuiltinToolExecutors()
	serverTools := s.createServerToolExecutors(model)
	allTools := agent.MergeExecutors(builtins, serverTools)

	var agentEvents []json.RawMessage

	agentConfig := agent.AgentConfig{
		Model:        model,
		SystemPrompt: chatSystemPrompt,
		Messages:     history,
		Temperature:  0.7,
		OnEvent: func(ev agent.AgentEvent) {
			data, _ := json.Marshal(ev)
			agentEvents = append(agentEvents, data)
			writeSSE(w, rc, "agent_event", string(data))
		},
	}
	for name, exec := range allTools {
		def := findToolDef(name)
		if def != nil {
			agentConfig.Tools = append(agentConfig.Tools, agent.AgentTool{Definition: *def, Execute: exec})
		}
	}

	log.Printf("🤖 Starting agent run (model=%s, history=%d msgs)", model, len(history))
	// Write trace to file for debugging where it hangs
	os.WriteFile("agent_trace.log", []byte(fmt.Sprintf("Starting agent run for conv=%s at %s\n", convID, time.Now().String())), 0644)
	agt := agent.NewAgent(agentConfig)
	result, runErr := agt.Run(body.Content)
	os.WriteFile("agent_trace.log", []byte(fmt.Sprintf("Agent run completed at %s, err=%v\n", time.Now().String(), runErr)), 0644)

	if runErr != nil {
		log.Printf("🤖 Agent run error: %v", runErr)
	}
	log.Printf("🤖 Agent run complete: iterations=%d, text_len=%d, tools=%d, blocks=%d, msgs=%d",
		result.IterationCount, len(result.Text), len(result.ToolResults), len(result.Blocks), len(result.Messages))

	// Persist messages after agent run (user + tool + only last assistant)
	existingCount := len(history)
	finalMsgs := result.Messages

	var assistantMsgID string
	lastAssistantIdx := -1
	for i := existingCount; i < len(finalMsgs); i++ {
		if finalMsgs[i].Role == agent.RoleAssistant {
			lastAssistantIdx = i
		}
	}
	for i := existingCount; i < len(finalMsgs); i++ {
		m := finalMsgs[i]
		msgID := uuidV4()
		switch m.Role {
		case agent.RoleAssistant:
			if i != lastAssistantIdx {
				continue
			}
			assistantMsgID = msgID
			sm := toStoredMessage(convID, "assistant", m.Content, result.Blocks, nil, agentEvents)
			sm.ID = msgID
			if err := s.db.AddMessage(sm); err != nil {
				log.Printf("Failed to persist assistant message: %v", err)
			}
		case agent.RoleUser:
			sm := toStoredMessage(convID, "user", m.Content, nil, nil, nil)
			sm.ID = msgID
			if err := s.db.AddMessage(sm); err != nil {
				log.Printf("Failed to persist user message: %v", err)
			}
		case agent.RoleTool:
			sm := toStoredMessage(convID, "tool", m.Content, nil, nil, nil)
			sm.ID = msgID
			sm.ToolCallID = m.ToolCallID
			sm.ToolName = m.ToolName
			if err := s.db.AddMessage(sm); err != nil {
				log.Printf("Failed to persist tool message: %v", err)
			}
		}
	}

	// Auto-title on first messages
	if existingCount <= 1 {
		title := body.Content
		if len(title) > 60 {
			title = title[:60] + "..."
		}
		s.db.UpdateConversationTitle(convID, title)
	}

	doneData, _ := json.Marshal(map[string]interface{}{
		"type":    "done",
		"msgId":   assistantMsgID,
		"content": result.Text,
		"blocks":  result.Blocks,
	})
	writeSSE(w, rc, "agent_event", string(doneData))
}

func (s *Server) createServerToolExecutors(model string) map[string]agent.ToolExecutor {
	return map[string]agent.ToolExecutor{
		"get_article": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct{ Slug string `json:"slug"` }
			if err := json.Unmarshal(args, &p); err != nil || p.Slug == "" {
				return agent.ToolResult{Result: "Slug required"}, nil
			}
			article, err := s.db.GetArticle(p.Slug)
			if err != nil || article == nil {
				return agent.ToolResult{Result: "Article not found"}, nil
			}
			data, _ := json.Marshal(article)
			return agent.ToolResult{Result: string(data)}, nil
		},
		"create_article": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct{ Slug string `json:"slug"` }
			if err := json.Unmarshal(args, &p); err != nil || p.Slug == "" {
				return agent.ToolResult{Result: "Slug required"}, nil
			}
			// Skip if already generated — matches handleGenerateArticle's guard.
			if existing, _ := s.db.GetArticle(p.Slug); existing != nil && existing.Metadata.Status == "published" {
				return agent.ToolResult{Result: fmt.Sprintf(`{"status":"already_exists","slug":"%s"}`, p.Slug)}, nil
			}
			// Enqueue through the same bounded worker pool as the HTTP path.
			if !s.queue.Submit(p.Slug, "veritas") {
				return agent.ToolResult{Result: fmt.Sprintf(`{"status":"busy","slug":"%s","error":"already queued or queue full"}`, p.Slug)}, nil
			}
			return agent.ToolResult{Result: fmt.Sprintf(`{"queued":true,"slug":"%s"}`, p.Slug)}, nil
		},
		"article_search": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct {
				Query      string `json:"query"`
				MaxResults int    `json:"maxResults"`
			}
			if err := json.Unmarshal(args, &p); err != nil || p.Query == "" {
				return agent.ToolResult{Result: "Query required"}, nil
			}
			if p.MaxResults <= 0 {
				p.MaxResults = 5
			}
			results, err := s.db.SearchArticles(p.Query, p.MaxResults)
			if err != nil || results == nil {
				return agent.ToolResult{Result: "No articles found"}, nil
			}
			data, _ := json.Marshal(results)
			return agent.ToolResult{Result: string(data)}, nil
		},
		"get_map": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct{ Slug string `json:"slug"` }
			if err := json.Unmarshal(args, &p); err != nil || p.Slug == "" {
				return agent.ToolResult{Result: "Slug required"}, nil
			}
			m, err := s.db.GetMap(p.Slug)
			if err != nil || m == nil {
				return agent.ToolResult{Result: "Map not found"}, nil
			}
			data, _ := json.Marshal(m)
			return agent.ToolResult{Result: string(data)}, nil
		},
		"suggest_related": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct{ Slug string `json:"slug"` }
			if err := json.Unmarshal(args, &p); err != nil || p.Slug == "" {
				return agent.ToolResult{Result: "Slug required"}, nil
			}
			edges, _ := s.db.GetGraphEdges(p.Slug)
			backlinks, _ := s.db.GetBacklinks(p.Slug)
			result, _ := json.Marshal(map[string]interface{}{"outgoing": edges, "incoming": backlinks})
			return agent.ToolResult{Result: string(result)}, nil
		},
		"mem_store": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}
			if err := json.Unmarshal(args, &p); err != nil {
				return agent.ToolResult{Result: "Invalid arguments"}, nil
			}
			if err := s.db.MemStore(p.Key, p.Value); err != nil {
				return agent.ToolResult{Result: fmt.Sprintf("Failed to store: %v", err)}, nil
			}
			return agent.ToolResult{Result: fmt.Sprintf("Stored \"%s\"", p.Key)}, nil
		},
		"mem_recall": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct{ Key string `json:"key"` }
			if err := json.Unmarshal(args, &p); err != nil {
				return agent.ToolResult{Result: "Invalid arguments"}, nil
			}
			v, err := s.db.MemRecall(p.Key)
			if err != nil || v == "" {
				return agent.ToolResult{Result: fmt.Sprintf("No stored value for \"%s\"", p.Key)}, nil
			}
			return agent.ToolResult{Result: v}, nil
		},
		"task": func(args json.RawMessage) (agent.ToolResult, error) {
			var p struct {
				Objective string   `json:"objective"`
				Tools     []string `json:"tools"`
			}
			if err := json.Unmarshal(args, &p); err != nil || p.Objective == "" {
				return agent.ToolResult{Result: "Objective required"}, nil
			}
			var toolDefs []agent.ToolDefinition
			allDefs := agent.ChatToolDefinitions()
			if len(p.Tools) > 0 {
				toolSet := make(map[string]bool, len(p.Tools))
				for _, t := range p.Tools {
					toolSet[t] = true
				}
				for _, d := range allDefs {
					if toolSet[d.Function.Name] {
						toolDefs = append(toolDefs, d)
					}
				}
			} else {
				for _, d := range allDefs {
					if d.Function.Name == "web_search" || d.Function.Name == "webfetch" {
						toolDefs = append(toolDefs, d)
					}
				}
			}
			m := model
			if m == "" {
				m = "deepseek-4-flash"
			}
			resp, err := agent.SendPromptStream(nil, "You are a research sub-agent.", m, 0.5, toolDefs, nil)
			if err != nil {
				return agent.ToolResult{Result: fmt.Sprintf("Sub-agent error: %v", err)}, nil
			}
			if resp.Text == "" {
				resp.Text = "Sub-agent completed with no output."
			}
			return agent.ToolResult{Result: resp.Text}, nil
		},
	}
}

func toStoredMessage(convID, role, content string, blocks []agent.Block, toolCalls []interface{}, agentEvents []json.RawMessage) *storage.StoredMessage {
	now := time.Now().UTC().Format(time.RFC3339)
	sm := &storage.StoredMessage{
		ID:             uuidV4(),
		ConversationID: convID,
		Role:           role,
		Content:        content,
		CreatedAt:      now,
	}
	for _, b := range blocks {
		var data interface{}
		json.Unmarshal(b.Data, &data)
		sm.Blocks = append(sm.Blocks, map[string]interface{}{"type": b.Type, "data": data})
	}
	for _, ev := range agentEvents {
		var parsed interface{}
		json.Unmarshal(ev, &parsed)
		sm.AgentEvents = append(sm.AgentEvents, parsed)
	}
	sm.ToolCalls = toolCalls
	return sm
}

func writeSSE(w http.ResponseWriter, rc *http.ResponseController, event, data string) {
	w.Write([]byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, data)))
	rc.Flush()
}

func findToolDef(name string) *agent.ToolDefinition {
	for _, d := range agent.ChatToolDefinitions() {
		if d.Function.Name == name {
			return &d
		}
	}
	return nil
}

func uuidV4() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func userIDFromRequest(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		log.Printf("🛑 auth: no Authorization header")
		return ""
	}
	if !strings.HasPrefix(auth, "Bearer ") {
		log.Printf("🛑 auth: Authorization header missing Bearer prefix: %q", auth[:min(len(auth), 20)])
		return ""
	}
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	userID, err := verifyJWT(tokenStr)
	if err != nil {
		log.Printf("🛑 auth: verifyJWT failed: %v (token preview: %q)", err, tokenStr[:min(len(tokenStr), 40)])
		return ""
	}
	log.Printf("✓ auth: user=%s", userID)
	return userID
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func storageToAgentMsg(m *storage.StoredMessage) agent.Message {
	msg := agent.Message{Role: agent.Role(m.Role), Content: m.Content, ToolCallID: m.ToolCallID, ToolName: m.ToolName}
	for _, tc := range m.ToolCalls {
		tcMap, ok := tc.(map[string]interface{})
		if !ok {
			continue
		}
		id, _ := tcMap["id"].(string)
		t := "function"
		if v, ok := tcMap["type"].(string); ok {
			t = v
		}
		funcMap, _ := tcMap["function"].(map[string]interface{})
		name, _ := funcMap["name"].(string)
		args, _ := funcMap["arguments"].(string)
		msg.ToolCalls = append(msg.ToolCalls, agent.ToolCall{
			ID:   id,
			Type: t,
			Function: agent.ToolCallFunc{
				Name:      name,
				Arguments: args,
			},
		})
	}
	return msg
}
