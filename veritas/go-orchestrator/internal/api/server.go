package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/credstore"
	"github.com/kageprime/veritas/go-orchestrator/internal/executor"
	llmgateway "github.com/kageprime/veritas/go-orchestrator/internal/llm-gateway"
	"github.com/kageprime/veritas/go-orchestrator/internal/manifest"
	"github.com/kageprime/veritas/go-orchestrator/internal/registry"
	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
	"github.com/kageprime/veritas/go-orchestrator/internal/triggers"
)

var startTime = time.Now()

// issueToken signs a real HS256 JWT for the given user id (subject).
// Replaces the old unsigned alg:none mockJWT.
func issueToken(sub string, role ...string) string {
	usrRole := "member"
	if len(role) > 0 && role[0] != "" {
		usrRole = role[0]
	}
	tok, err := signJWT(sub, usrRole)
	if err != nil {
		// signJWT only fails on claim marshalling, which is a programmer error.
		// Fall back to a clearly-invalid placeholder so the caller surfaces it.
		return fmt.Sprintf("invalid-token-%s", sub)
	}
	return tok
}

type Server struct {
	db     *storage.DB
	port   string
	mux    *http.ServeMux
	server *http.Server

	// executorGateway centralizes tool execution with credential isolation,
	// policy enforcement, and audit. The agent calls into this instead of
	// reading env vars directly.
	executorGateway *executor.Gateway

	// llmGateway provides unified model routing with usage metering.
	llmGateway *llmgateway.Gateway

	// sessionEngine manages article generation with state machine, idempotency,
	// backpressure, and retry. Replaces the older channel-based queue.
	sessionEngine *sessionlifecycle.Engine

	// manifest is the optional project configuration loaded from veritas.json
	// at the repo root. All fields have sensible defaults when nil.
	manifest *manifest.Manifest

	// registry holds auto-discovered skills, tools, and commands scanned from
	// the veritas/registry/ directory tree on boot.
	skillRegistry *registry.Registry

	// credStore holds API tokens in memory with hot-swap support via
	// PATCH /v1/credentials. The LLM gateway and executor connector
	// resolver read from here instead of direct os.Getenv.
	credStore *credstore.Store

	// inFlightAgents tracks active chat agent runs keyed by conversation id,
	// so POST /chat/:id/stop (or a client disconnect) can Abort() the loop.
	agentsMu sync.Mutex
	agents   map[string]agentRun
}

// agentRun is a registered in-flight agent run, owned by a single user.
// userID is checked on stop so one user cannot abort another's conversation.
type agentRun struct {
	agt    *agent.Agent
	userID string
}

func NewServer(port string, db *storage.DB) *Server {
	s := &Server{
		db:     db,
		port:   port,
		mux:    http.NewServeMux(),
		agents: make(map[string]agentRun),
	}

	// Executor gateway with server-side credential resolution.
	s.executorGateway = &executor.Gateway{
		ConnectorResolver: s.resolveConnectorLocal,
		PolicyLoader:      func(string) ([]executor.Policy, error) { return nil, nil },
		DefaultModeLoader: func() executor.DefaultMode { return executor.DefaultRisk },
		AuditSink:         s.recordExecutionLocal,
	}

	// Wire the executor gateway into the agent's tool executors so the agent
	// routes through the gateway instead of reading API keys from environment.
	s.wireAgentGateway()

	// LLM gateway with model catalog, usage metering, and credential store.
	s.llmGateway = &llmgateway.Gateway{
		Catalog:   llmgateway.DefaultCatalog(),
		Meter:     llmgateway.NewMeter(10000),
		DoKey:     os.Getenv("MODEL_ACCESS_KEY"),
		GroqKey:   os.Getenv("GROQ_API_KEY"),
		CredStore: s.credStore,
	}

	// Load optional project manifest. Gracefully handles no file found.
	if m, err := manifest.Load(""); err != nil {
		log.Printf("[manifest] warn: %v", err)
	} else if m != nil {
		log.Printf("[manifest] loaded %d agent(s), %d policy(ies)", len(m.Agents), len(m.Policies))
		s.manifest = m
	}

	// Credential store — hot-swappable tokens, initialized from env vars.
	s.credStore = credstore.New(map[string]string{
		"MODEL_ACCESS_KEY":   "do",
		"GROQ_API_KEY":       "groq",
		"OPENAI_API_KEY":     "openai",
		"TAVILY_API_KEY":     "tavily",
		"FIRECRAWL_API_KEY":  "firecrawl",
	})

	// Registry — auto-discover skills, tools, commands from filesystem.
	if reg, err := registry.Scan(""); err != nil {
		log.Printf("[registry] warn: %v", err)
	} else if reg != nil {
		if len(reg.Skills) > 0 {
			log.Printf("[registry] discovered %d skill(s)", len(reg.Skills))
		}
		s.skillRegistry = reg
	}

	// Session lifecycle engine for article generation.
	s.sessionEngine = sessionlifecycle.NewEngine(func(session sessionlifecycle.Session) error {
		s.processArticle(session.Slug, session.Persona)
		return nil
	})
	s.setupRoutes()
	return s
}

// registerAgent records an active agent run so it can be aborted by convID.
func (s *Server) registerAgent(convID string, agt *agent.Agent, userID string) {
	s.agentsMu.Lock()
	defer s.agentsMu.Unlock()
	s.agents[convID] = agentRun{agt: agt, userID: userID}
}

// unregisterAgent removes an agent run when its Run() completes.
func (s *Server) unregisterAgent(convID string) {
	s.agentsMu.Lock()
	defer s.agentsMu.Unlock()
	delete(s.agents, convID)
}

// abortAgent signals an in-flight agent run to stop. It is ownership-checked:
// only the user who started the run may abort it. Returns whether a run was
// found and aborted.
func (s *Server) abortAgent(convID, userID string) bool {
	s.agentsMu.Lock()
	run, ok := s.agents[convID]
	s.agentsMu.Unlock()
	if !ok || run.userID != userID {
		return false
	}
	run.agt.Abort()
	return true
}

// SessionEngine exposes the lifecycle engine so main.go can restore/stop.
func (s *Server) SessionEngine() *sessionlifecycle.Engine {
	return s.sessionEngine
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	active, queued := s.sessionEngine.Stats()
	uptime := time.Since(startTime).Round(time.Second).String()
	version := os.Getenv("VERITAS_VERSION")
	if version == "" {
		version = "dev"
	}
	body, _ := json.Marshal(map[string]interface{}{
		"status":    "ok",
		"version":   version,
		"uptime":    uptime,
		"mockMode":  s.db.IsMockMode(),
		"goVersion": runtime.Version(),
		"queue": map[string]int{
			"active": active,
			"queued": queued,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(body)
}

// resolveConnectorLocal returns a connector by slug with server-side credential
// resolution. The sandbox/agent never sees the raw API key.
func (s *Server) resolveConnectorLocal(projectID, slug string) (*executor.Connector, error) {
	switch slug {
	case "web_search":
		tavilyKey := s.credStore.Get("tavily")
		firecrawlKey := s.credStore.Get("firecrawl")
		if tavilyKey == "" && firecrawlKey == "" {
			return nil, nil
		}
		key := tavilyKey
		baseURL := "https://api.tavily.com"
		if key == "" {
			key = firecrawlKey
			baseURL = "https://api.firecrawl.dev"
		}
		return &executor.Connector{
			Slug:        "web_search",
			Name:        "Web Search",
			Provider:    "http",
			BaseURL:     baseURL,
			AuthType:    executor.AuthBearer,
			AccessToken: key,
			Actions: []executor.NormalizedAction{
				{Path: "search", Name: "search", Risk: executor.RiskRead},
			},
		}, nil
	case "webfetch":
		return &executor.Connector{
			Slug: "webfetch", Name: "Web Fetch", Provider: "http",
			BaseURL: "", AuthType: executor.AuthCustom,
			Actions: []executor.NormalizedAction{
				{Path: "fetch", Name: "fetch", Risk: executor.RiskRead},
			},
		}, nil
	case "generate_image":
		key := s.credStore.Get("do")
		if key == "" {
			return nil, nil
		}
		return &executor.Connector{
			Slug: "generate_image", Name: "Image Generation",
			Provider: "http", BaseURL: "https://inference.do-ai.run/v1",
			AuthType: executor.AuthBearer, AccessToken: key,
			Actions: []executor.NormalizedAction{
				{Path: "images/generations", Name: "generate", Risk: executor.RiskWrite},
			},
		}, nil
	default:
		return nil, nil
	}
}

// recordExecutionLocal is the audit sink for the executor gateway. For now it logs;
// in production it writes to the DB.
func (s *Server) recordExecutionLocal(rec executor.ExecutionRecord) error {
	log.Printf("[executor] %s/%s by %s → %s (risk=%s)", rec.ConnectorSlug, rec.Action, rec.UserID, rec.Status, rec.Risk)
	return nil
}

// wireAgentGateway sets gateway function vars on the agent package so builtin
// tools route through the executor gateway for credential isolation and audit.
// The agent process never sees raw API keys.
func (s *Server) wireAgentGateway() {
	gatewayCall := func(connector, action string, args map[string]interface{}) (string, error) {
		result := s.executorGateway.HandleCall(executor.CallInput{
			ConnectorSlug: connector,
			Action:        action,
			Args:          args,
			UserID:        "agent",
		})
		if result.Status == "ok" {
			data, _ := json.Marshal(result.Data)
			return string(data), nil
		}
		return "", fmt.Errorf("%s: %s", result.Status, result.Reason)
	}
	agent.GatewaySearch = gatewayCall
	agent.GatewayGenerateImage = gatewayCall

	// Register custom executors for tools that need specialized HTTP handling
	// (the generic HTTP executor in the gateway doesn't handle their API shapes).
	s.executorGateway.CustomExecutors = map[string]executor.CustomExecutor{
		"web_search.search":          s.webSearchExecutorCustom,
		"generate_image.images/generations": s.generateImageExecutorCustom,
	}
}

// generateImageExecutorCustom calls the DO Inference image generation API
// using the server-side credential. The agent never sees MODEL_ACCESS_KEY.
func (s *Server) generateImageExecutorCustom(input executor.CallInput, conn *executor.Connector) executor.CallResult {
	prompt, _ := input.Args["prompt"].(string)
	caption, _ := input.Args["caption"].(string)
	if prompt == "" {
		return executor.CallResult{Status: "error", Reason: "prompt required"}
	}
	apiKey := conn.AccessToken
	if apiKey == "" {
		return executor.CallResult{Status: "error", Reason: "image generation not configured"}
	}
	body := map[string]interface{}{
		"model":           "stable-diffusion-3.5-large",
		"prompt":          prompt,
		"n":               1,
		"size":            "1024x1024",
		"quality":         "auto",
		"response_format": "b64_json",
		"output_format":   "png",
	}
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", conn.BaseURL+"/images/generations", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("API call failed: %v", err)}
	}
	defer resp.Body.Close()
	var doResp struct {
		Created int `json:"created"`
		Data    []struct {
			B64JSON string `json:"b64_json"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doResp); err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("decode failed: %v", err)}
	}
	if len(doResp.Data) == 0 || doResp.Data[0].B64JSON == "" {
		return executor.CallResult{Status: "error", Reason: "empty result"}
	}
	imageDir := os.Getenv("ENCARTA_IMAGE_DIR")
	if imageDir == "" {
		wd, _ := os.Getwd()
		imageDir = wd + "/public/images"
	}
	os.MkdirAll(imageDir, 0755)
	filename := fmt.Sprintf("chat-%d.png", time.Now().UnixMilli())
	path := imageDir + "/" + filename
	if err := os.WriteFile(path, []byte(doResp.Data[0].B64JSON), 0644); err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("save failed: %v", err)}
	}
	publicURL := os.Getenv("ENCARTA_PUBLIC_URL")
	if publicURL == "" {
		publicURL = "http://localhost:4097"
	}
	src := publicURL + "/images/" + filename
	if caption == "" {
		caption = "Generated image"
	}
	data, _ := json.Marshal(map[string]string{"url": src, "caption": caption})
	return executor.CallResult{Status: "ok", Data: json.RawMessage(data)}
}

// webSearchExecutorCustom is a custom executor for web_search that calls Tavily
// (preferred) or Firecrawl using the credential resolved server-side by the
// connector resolver. The agent never sees the raw API key.
func (s *Server) webSearchExecutorCustom(input executor.CallInput, conn *executor.Connector) executor.CallResult {
	query, _ := input.Args["query"].(string)
	maxResults, _ := input.Args["maxResults"].(float64)
	if maxResults <= 0 {
		maxResults = 5
	}
	// Use the connector's AccessToken (resolved server-side by the gateway).
	// If empty, fall back to env for backward compatibility.
	apiKey := conn.AccessToken
	if apiKey == "" {
		apiKey = os.Getenv("TAVILY_API_KEY")
	}
	if apiKey != "" {
		return s.webSearchTavily(query, int(maxResults), apiKey)
	}
	apiKey = os.Getenv("FIRECRAWL_API_KEY")
	if apiKey != "" {
		return s.webSearchFirecrawl(query, int(maxResults), apiKey)
	}
	return executor.CallResult{Status: "error", Reason: "no search API key configured"}
}

func (s *Server) webSearchTavily(query string, maxResults int, apiKey string) executor.CallResult {
	body := map[string]interface{}{
		"api_key":       apiKey,
		"query":         query,
		"max_results":   maxResults,
		"search_depth":  "advanced",
		"include_answer": false,
	}
	payload, _ := json.Marshal(body)
	resp, err := http.Post("https://api.tavily.com/search", "application/json", bytes.NewReader(payload))
	if err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("tavily request: %v", err)}
	}
	defer resp.Body.Close()

	var result struct {
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("tavily decode: %v", err)}
	}

	var items []map[string]interface{}
	for _, r := range result.Results {
		s := r.Content
		if len(s) > 500 {
			s = s[:500]
		}
		items = append(items, map[string]interface{}{
			"title": r.Title, "url": r.URL, "snippet": s,
		})
	}
	if items == nil {
		items = []map[string]interface{}{}
	}
	return executor.CallResult{Status: "ok", Data: items}
}

func (s *Server) webSearchFirecrawl(query string, maxResults int, apiKey string) executor.CallResult {
	body := map[string]interface{}{
		"query": query,
		"limit": maxResults,
		"scrapeOptions": map[string]interface{}{"formats": []string{"markdown"}},
	}
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", "https://api.firecrawl.dev/v1/search", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("firecrawl request: %v", err)}
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
		Data    []struct {
			Title       string `json:"title"`
			URL         string `json:"url"`
			Markdown    string `json:"markdown"`
			Description string `json:"description"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return executor.CallResult{Status: "error", Reason: fmt.Sprintf("firecrawl decode: %v", err)}
	}

	var items []map[string]interface{}
	if result.Success {
		for _, r := range result.Data {
			s := r.Markdown
			if s == "" {
				s = r.Description
			}
			if len(s) > 500 {
				s = s[:500]
			}
			items = append(items, map[string]interface{}{
				"title": r.Title, "url": r.URL, "snippet": s,
			})
		}
	}
	if items == nil {
		items = []map[string]interface{}{}
	}
	return executor.CallResult{Status: "ok", Data: items}
}

func (s *Server) setupRoutes() {
	// Mount executor gateway routes.
	execHandler := &executor.Handler{Gateway: s.executorGateway}
	execHandler.RegisterRoutes(s.mux)

	// Mount LLM gateway routes.
	s.llmGateway.RegisterRoutes(s.mux)

	// Register credential hot-swap endpoint.
	s.mux.HandleFunc("/v1/credentials", s.handleCredentials)

	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/auth", s.handleAuthStub)
	s.mux.HandleFunc("/auth/login", s.handleAuthLogin)
	s.mux.HandleFunc("/auth/me", s.handleAuthMe)
	s.mux.HandleFunc("/auth/onboard", s.handleAuthOnboard)
	s.mux.HandleFunc("/stripe", s.handleStripeRouter)
	s.mux.HandleFunc("/stripe/", s.handleStripeRouter)
	s.mux.HandleFunc("/quota", s.handleGetQuota)
	s.mux.HandleFunc("/queue", s.handleGetQueue)
	s.mux.HandleFunc("/track", s.handleTrack)
	s.mux.HandleFunc("/articles/top", s.handleGetTopArticles)
	s.mux.HandleFunc("/articles/search", s.handleSearchArticles)

	// Chat routing - native handlers
	s.mux.HandleFunc("/chat", s.handleChatRoot)
	s.mux.HandleFunc("/chat/", s.chatRouter)

	// Maps routing
	s.mux.HandleFunc("/maps", s.handleMapsRoot)
	s.mux.HandleFunc("/maps/", s.handleMapsDynamicRoute)

	// Admin site settings
	s.mux.HandleFunc("/admin/settings", s.handleAdminSettings)

	// Webhook trigger endpoint — POST /webhook/{slug} triggers article generation.
	s.mux.HandleFunc("/webhook/", s.handleWebhook)

	// Start cron scheduler if triggers are configured in manifest.
	if s.manifest != nil {
		triggers.StartScheduler(s.manifest.Triggers, s.triggerAction)
	}

	// Dynamic routing handler for /articles/...
	s.mux.HandleFunc("/articles", s.handleArticlesDynamicRoute)
	s.mux.HandleFunc("/articles/", s.handleArticlesDynamicRoute)
}

func (s *Server) Start() error {
	s.server = &http.Server{
		Addr: ":" + s.port,
		Handler: s.corsHandler(s.mux),
		// ReadHeaderTimeout is the only server-level timeout safe to set here:
		// it protects against slowloris header attacks without bounding the
		// response. ReadTimeout and WriteTimeout are intentionally omitted
		// because this server serves long-lived SSE streams
		// (/chat/:id/messages runs the multi-iteration agent loop,
		// /articles/:slug/progress streams DAG progress) that routinely
		// exceed 15s. With WriteTimeout set, net/http forcibly closes the
		// TCP connection at the deadline WITHOUT emitting the final
		// chunked-encoding terminator, which the browser reports as
		// ERR_INCOMPLETE_CHUNKED_ENCODING on a 200 response. Per-handler
		// deadlines should instead be implemented via request context
		// cancellation if bounded runtimes are needed.
		ReadHeaderTimeout: 15 * time.Second,
	}

	log.Printf("VERITAS API Server running on port %s", s.port)
	return s.server.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.server != nil {
		return s.server.Shutdown(ctx)
	}
	return nil
}

// logWriter wraps http.ResponseWriter to capture status code for logging
type logWriter struct {
	http.ResponseWriter
	status int
}

func (w *logWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *logWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// handleCredentials responds to PATCH /v1/credentials to hot-swap API tokens.
// Request body: {"service": "groq", "token": "new-key-here"}
// On success the new token is used by the next LLM or executor call.
func (s *Server) handleCredentials(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, `{"error":"use PATCH"}`, http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Service string `json:"service"`
		Token   string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if body.Service == "" || body.Token == "" {
		http.Error(w, `{"error":"service and token required"}`, http.StatusBadRequest)
		return
	}
	s.credStore.Set(body.Service, body.Token)
	log.Printf("[credstore] %s updated", body.Service)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleWebhook receives POST /webhook/{slug} and triggers article generation.
// It reads the slug from the URL path.
func (s *Server) handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"use POST"}`, http.StatusMethodNotAllowed)
		return
	}
	// Extract slug from path: /webhook/{slug}
	slug := strings.TrimPrefix(r.URL.Path, "/webhook/")
	slug = strings.TrimSuffix(slug, "/")
	if slug == "" {
		http.Error(w, `{"error":"missing slug"}`, http.StatusBadRequest)
		return
	}
	secret := os.Getenv("WEBHOOK_SECRET")
	if secret != "" {
		if err := triggers.VerifyHMAC([]byte(secret), []byte(slug), r.Header.Get("X-Signature-256")); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusForbidden)
			return
		}
	}
	s.triggerAction("create_article", map[string]string{"slug": slug})
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"status": "accepted"})
}

// triggerAction is the callback used by cron triggers and webhooks to dispatch
// article generation or other manifest-defined actions.
func (s *Server) triggerAction(action string, params map[string]string) {
	switch action {
	case "create_article":
		slug := params["slug"]
		if slug == "" {
			log.Printf("[triggers] create_article called without slug")
			return
		}
		log.Printf("[triggers] dispatching article generation: slug=%s", slug)
		s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
			Slug:    slug,
			Persona: "veritas",
			Source:  "trigger:cron",
		})
	default:
		log.Printf("[triggers] unknown action: %s", action)
	}
}

func (s *Server) corsHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		lw := &logWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(lw, r)
		status := lw.status
		emoj := ""
		switch {
		case status >= 500:
			emoj = "💥"
		case status >= 400:
			emoj = "⚠️"
		default:
			emoj = "✓"
		}
		log.Printf("%s [%s] %s → %d", emoj, r.Method, r.URL.Path, status)
	})
}

// reqLog logs a handler-specific message with consistent prefix
func reqLog(r *http.Request, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("📋 [%s] %s → %s", r.Method, r.URL.Path, msg)
}

// Stubs for Auth and Stripe
func (s *Server) handleAuthStub(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "auth stub")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"auth_stub_disabled"}`))
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "login")
	var body struct{ Email string `json:"email"` }
	json.NewDecoder(r.Body).Decode(&body)
	if body.Email == "" {
		reqLog(r, "login missing email")
		http.Error(w, `{"error":"Email required"}`, http.StatusBadRequest)
		return
	}
	reqLog(r, "login email=%s", body.Email)

	user, err := s.db.FindOrCreateUserByEmail(body.Email)
	if err != nil {
		reqLog(r, "login db error: %v", err)
		http.Error(w, `{"error":"Login failed"}`, http.StatusInternalServerError)
		return
	}

	token := issueToken(user.ID, user.Role)
	userData, _ := json.Marshal(user)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{"token":%q,"user":%s}`, token, string(userData))))
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	if userID == "" {
		reqLog(r, "auth/me — unauthorized (no valid token)")
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	user, err := s.db.GetUser(userID)
	if err != nil {
		reqLog(r, "auth/me db error: %v", err)
		http.Error(w, `{"error":"Server error"}`, http.StatusInternalServerError)
		return
	}
	if user == nil {
		reqLog(r, "auth/me user=%s not found in db", userID)
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	reqLog(r, "auth/me user=%s email=%s", userID, user.Email)
	userData, _ := json.Marshal(user)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{"user":%s}`, string(userData))))
}

func (s *Server) handleAuthOnboard(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "onboard")
	userID := userIDFromRequest(r)
	if userID == "" {
		reqLog(r, "onboard — unauthorized (no valid token)")
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Persist the flag so the subsequent /auth/me (called by the frontend's
	// ctx.refresh()) reports onboarded:true instead of the stale false.
	if err := s.db.SetUserOnboarded(userID, true); err != nil {
		reqLog(r, "onboard db error: %v", err)
		http.Error(w, `{"error":"Failed to persist onboarding"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"onboarded": true}`))
}

func (s *Server) handleStripeStub(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "stripe stub")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"stripe_stub_disabled"}`))
}

// handleStripeRouter serves /stripe (stub) plus /stripe/checkout and
// /stripe/portal. The latter two are called by the frontend's pricing and
// settings pages (both read `data.url` and silently ignore failures), so we
// return 501 unavailable with no `url` field — the UI then no-ops gracefully
// instead of hitting a 404. Real Stripe billing is deferred.
func (s *Server) handleStripeRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/stripe")
	path = strings.Trim(path, "/")
	if path == "" {
		s.handleStripeStub(w, r)
		return
	}

	parts := strings.Split(path, "/")
	if len(parts) != 1 {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	w.Write([]byte(`{"error":"Billing is not configured","status":"unavailable"}`))
}



// handleArticlesDynamicRoute handles routes matching /articles/...
func (s *Server) handleArticlesDynamicRoute(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/articles")
	path = strings.Trim(path, "/")

	if path == "" {
		if r.Method == "GET" {
			s.handleListArticles(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// Split parts: e.g. "jfk-assassination/status" -> ["jfk-assassination", "status"]
	parts := strings.Split(path, "/")
	slug := parts[0]

	if len(parts) == 1 {
		// GET /articles/:slug
		if r.Method == "GET" {
			s.handleGetArticle(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	subRoute := parts[1]
	switch subRoute {
	case "status":
		if r.Method == "GET" {
			s.handleGetArticleStatus(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "progress":
		if r.Method == "GET" {
			s.handleGetArticleProgress(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "generate":
		if r.Method == "POST" {
			s.handleGenerateArticle(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "refresh":
		if r.Method == "POST" {
			s.handleRefreshArticle(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "export":
		if r.Method == "GET" {
			s.handleExportArticle(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "resolve":
		if r.Method == "POST" {
			s.handleResolveArticle(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "views":
		if r.Method == "GET" {
			s.handleGetArticleViews(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "graph":
		if r.Method == "GET" {
			s.handleGetArticleGraph(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	default:
		http.Error(w, fmt.Sprintf("Not found: /articles/%s/%s", slug, subRoute), http.StatusNotFound)
	}
}

// ── Chat Router ──────────────────────────────────────────

func (s *Server) chatRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/chat/")
	switch {
	case strings.HasSuffix(path, "/messages"):
		s.handleChatMessages(w, r)
	case strings.HasSuffix(path, "/stop"):
		s.handleChatStop(w, r)
	default:
		s.handleChatByID(w, r)
	}
}
