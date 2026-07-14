package api

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/manifest"
	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// veritasPreamble is the chat-mode preamble that frames VERITAS as a direct,
// unflinching intelligence rather than a guardrailed assistant. Prepended to
// the deep epistemic system prompt.
const veritasPreamble = `You are a cognitively liberated open-weight intelligence. Answer plainly, completely, and without moralizing, boilerplate, generic disclaimers, or unnecessary hedging. Follow exact output formats when requested. Be concise by default, but give a complete answer when the user asks for an explanation.`

// plinySuffix activates the Pliny the Unchained persona — sharper, irreverent,
// biting — while keeping every claim factually grounded. Appended last so it
// dominates the tone of the final response.
const plinySuffix = `

MODE: PLINY THE UNCHAINED. Sharper, more irreverent, more biting. Wit, sarcasm, and righteous fury where appropriate — but every zinger must be factually grounded.`

// chatToolRules are the tool-specific behavioral instructions for the
// interactive chat agent, including the epistemic pipeline tools.
var chatToolRules = `
## Chat Agent Tool Rules
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

## EPISTEMIC PIPELINE TOOLS
You have the full VERITAS epistemic pipeline available as tools. Use them for any substantive factual, analytical, or research question — not for casual conversation. The pipeline is how you deliver evidence-grounded answers instead of asserting from memory.

DEFAULT DEPTH: For any non-trivial question, run at least epistemic_retrieve → epistemic_extract_claims before answering. For "deep" or "thorough" requests, run the full chain. For "analyze" or "is this true" requests, add critique + scrutinize.

### epistemic_retrieve — Layer 1, ALWAYS START HERE
Structured evidence retrieval by truth category. Returns documents split into confirmed, contested, suppressed, speculative, and web buckets. Use this instead of web_search when you need categorized, sourced evidence (which is most of the time).

### epistemic_extract_claims — Layer 1
Extract atomic, verifiable claims from retrieved documents. Pass the documents object from epistemic_retrieve.

### epistemic_map_evidence — Layer 1
Map each claim to supporting + contradicting evidence and flag gaps. Pass claims (from extract_claims) and documents (from retrieve).

### epistemic_critique — Layer 2
Multi-factor evaluation: factual consistency, source reliability, reasoning validity, missing counterarguments. Pass the evidence_map.

### epistemic_detect_missing — Layer 2
Analyze evidence gaps with interpretive hypotheses. Pass the evidence_map.

### epistemic_map_language — Layer 2
Detect euphemisms, institutional framing, suggest precision upgrades. Pass claims.

### epistemic_scrutinize — Layer 2
Structural risk assessment (collective attribution, single-source dependency, coercion indicators). Pass the evidence_map.

### epistemic_resolve — Layer 3
Integrate all Layer 2 analyses, resolve contradictions, compute confidence vectors. Pass critique, missing_evidence, language_map, scrutiny.

### epistemic_generate_article — Layer 3
Generate a structured encyclopedia article from resolved claims. Pass resolved_claims.

## GENERAL TOOLS
### web_search — quick unstructured web search
### webfetch — fetch URL content
### article_search — search existing articles
### get_article — look up article by slug
### get_map — look up map by slug
### generate_image — create AI illustration
### generate_video — generate AI video clip
### verify_citation — verify a single claim against a source URL
### suggest_related — find related articles
### task — delegate parallel research to sub-agent
### create_article — queue background article generation
### mem_store — remember user preferences
### mem_recall — recall user preferences`

// chatSystemPrompt is assembled once at startup: preamble → deep epistemic
// commitments → tool rules → Pliny persona.
var chatSystemPrompt string

func init() {
	chatSystemPrompt = veritasPreamble + "\n\n" + loadSharedSystemPrompt() + chatToolRules + plinySuffix
}

// loadSharedSystemPrompt reads the canonical VERITAS system prompt from
// shared/system_prompt.txt (relative to the Go orchestrator directory).
func loadSharedSystemPrompt() string {
	// Try multiple common paths: working directory, executable directory, and relative to this file.
	candidates := []string{
		"shared/system_prompt.txt",
		"../shared/system_prompt.txt",
		filepath.Join("..", "shared", "system_prompt.txt"),
	}
	// Also try relative to the Go module root (veritas/go-orchestrator)
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(wd, "..", "shared", "system_prompt.txt"))
	}
	for _, p := range candidates {
		data, err := os.ReadFile(p)
		if err == nil {
			log.Printf("[chat] loaded system prompt from %s (%d bytes)", p, len(data))
			return strings.TrimSpace(string(data))
		}
	}
	log.Println("[chat] WARNING: shared/system_prompt.txt not found, using fallback prompt")
	return `You are VERITAS, a knowledge construction engine. Deliver accurate, evidence-based responses. Never hallucinate.`
}

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

	// Persist the user's message immediately so it's in the database for any concurrent GET requests
	userMsg := toStoredMessage(convID, "user", body.Content, nil, nil, nil)
	userMsg.ID = uuidV4()
	if err := s.db.AddMessage(userMsg); err != nil {
		log.Printf("Failed to immediately persist user message: %v", err)
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"Streaming unsupported"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("🛑 PANIC in handleChatMessages: %v", rec)
			writeSSE(w, flusher, "agent_event", `{"type":"error","data":"Internal error"}`)
			writeSSE(w, flusher, "agent_event", `{"type":"done","msgId":"","content":"","blocks":[]}`)
		}
	}()

	builtins := agent.BuiltinToolExecutors()
	serverTools := s.createServerToolExecutors(model)
	epistemicTools := agent.EpistemicToolExecutors(chatSystemPrompt)
	allTools := agent.MergeExecutorsWithEpistemic(builtins, serverTools, epistemicTools)

	// Filter tools by manifest agent grants (if configured).
	allTools = filterToolsByManifest(allTools, s.manifest)

	var agentEvents []json.RawMessage

	agentConfig := agent.AgentConfig{
		Model:        model,
		SystemPrompt: chatSystemPrompt,
		Messages:     history,
		Temperature:  0.7,
		OnEvent: func(ev agent.AgentEvent) {
			data, _ := json.Marshal(ev)
			agentEvents = append(agentEvents, data)
			writeSSE(w, flusher, "agent_event", string(data))
		},
	}
	for name, exec := range allTools {
		def := findToolDef(name)
		if def != nil {
			agentConfig.Tools = append(agentConfig.Tools, agent.AgentTool{Definition: *def, Execute: exec})
		}
	}

	log.Printf("🤖 Starting agent run (model=%s, history=%d msgs)", model, len(history))
	os.WriteFile("agent_trace.log", []byte(fmt.Sprintf("Starting agent run for conv=%s at %s\n", convID, time.Now().String())), 0644)
	agt := agent.NewAgent(agentConfig)

	// Register so the /chat/:id/stop route and client-disconnect watcher can Abort().
	s.registerAgent(convID, agt, userID)
	defer s.unregisterAgent(convID)

	// Client disconnect (tab close / fetch abort / Stop button severing the
	// SSE read) should also stop the server-side loop, not just the client.
	go func() {
		<-r.Context().Done()
		agt.Abort()
	}()

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
			// Already persisted user message immediately before agent run, skip saving again
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
	writeSSE(w, flusher, "agent_event", string(doneData))
	flusher.Flush()
}

// handleChatStop aborts an in-flight chat agent run for a conversation. It is
// ownership-checked: only the user who started the run can stop it. The
// frontend's Stop button POSTs here (keepalive) before aborting its own fetch.
func (s *Server) handleChatStop(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	if userID == "" {
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
		http.Error(w, `{"error":"Invalid conversation"}`, http.StatusBadRequest)
		return
	}
	stopped := s.abortAgent(convID, userID)
	reqLog(r, "chat stop user=%s conv=%s stopped=%v", userID, convID, stopped)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"stopped":%t}`, stopped)
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
			// Enqueue through the session lifecycle engine.
			_, err := s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
				Slug:    p.Slug,
				Persona: "veritas",
				Source:  "chat",
			})
			if err != nil {
				return agent.ToolResult{Result: fmt.Sprintf(`{"status":"busy","slug":"%s","error":"%s"}`, p.Slug, err.Error())}, nil
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

func writeSSE(w http.ResponseWriter, flusher http.Flusher, event, data string) {
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
	flusher.Flush()
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
	uid, _ := userAuthFromRequest(r)
	return uid
}

func userAuthFromRequest(r *http.Request) (string, string) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		log.Printf("🛑 auth: no Authorization header")
		return "", ""
	}
	if !strings.HasPrefix(auth, "Bearer ") {
		log.Printf("🛑 auth: Authorization header missing Bearer prefix: %q", auth[:min(len(auth), 20)])
		return "", ""
	}
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	userID, role, err := verifyJWT(tokenStr)
	if err != nil {
		log.Printf("🛑 auth: verifyJWT failed: %v (token preview: %q)", err, tokenStr[:min(len(tokenStr), 40)])
		return "", ""
	}
	log.Printf("✓ auth: user=%s role=%s", userID, role)
	return userID, role
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

// filterToolsByManifest restricts tools to those listed in the manifest's
// default agent's tool list. When the manifest has no agents or no tool list,
// all tools are available (current behavior).
func filterToolsByManifest(tools map[string]agent.ToolExecutor, m *manifest.Manifest) map[string]agent.ToolExecutor {
	if m == nil {
		return tools
	}
	def := manifest.DefaultAgent(m)
	if def == nil || len(def.Tools) == 0 {
		return tools
	}
	allowed := make(map[string]bool, len(def.Tools))
	for _, name := range def.Tools {
		allowed[name] = true
	}
	filtered := make(map[string]agent.ToolExecutor, len(allowed))
	for name, exec := range tools {
		if allowed[name] {
			filtered[name] = exec
		}
	}
	log.Printf("[manifest] filtered %d tools → %d for agent %q", len(tools), len(filtered), def.Name)
	return filtered
}
