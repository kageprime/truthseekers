package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/credstore"
	"github.com/kageprime/veritas/go-orchestrator/internal/executor"
	"github.com/kageprime/veritas/go-orchestrator/internal/iam"
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

// ────────────────────────────────────────────────────────────
// Middleware: Rate Limiting + Authorization
// ────────────────────────────────────────────────────────────

// rateLimiter provides simple in-memory token-bucket rate limiting per IP.
type rateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*tokenBucket
	rate     int           // requests per window
	window   time.Duration // window size
}

type tokenBucket struct {
	tokens     int
	lastRefill time.Time
}

func newRateLimiter(rate int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		buckets: make(map[string]*tokenBucket),
		rate:    rate,
		window:  window,
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	b, ok := rl.buckets[ip]
	if !ok || now.Sub(b.lastRefill) >= rl.window {
		b = &tokenBucket{tokens: rl.rate, lastRefill: now}
		rl.buckets[ip] = b
	}
	if b.tokens <= 0 {
		return false
	}
	b.tokens--
	return true
}

func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !rl.allow(ip) {
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.Split(xff, ",")[0]
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}

// authMiddleware validates JWT and injects userID/role into request context.
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, role := userAuthFromRequest(r)
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), "userID", userID)
		ctx = context.WithValue(ctx, "userRole", role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// optionalAuthMiddleware injects userID/role when a valid JWT is present but
// does not reject unauthenticated requests. Used for public-read article
// routes so anonymous browsing works while write sub-routes can still gate on
// an authenticated context via requireCtxAuth.
func (s *Server) optionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, role := userAuthFromRequest(r)
		if userID != "" {
			ctx := context.WithValue(r.Context(), "userID", userID)
			ctx = context.WithValue(ctx, "userRole", role)
			r = r.WithContext(ctx)
		}
		next.ServeHTTP(w, r)
	})
}

// requireCtxAuth writes a 401 and returns false when no authenticated user is
// present in the request context. Used to gate write sub-routes that ride on
// a public-read dynamic route.
func requireCtxAuth(w http.ResponseWriter, r *http.Request) bool {
	if userIDFromContext(r.Context()) == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return false
	}
	return true
}

// requireRole ensures the user has at least the minimum role for the resource.
func (s *Server) requireRole(minRole string, resourceType string, resourceID string, action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return s.authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := r.Context().Value("userRole").(string)
			_ = r.Context().Value("userID").(string)

			var projectRole *iam.ProjectRole
			// For now, we don't have project membership - use implicit role
			if implicit := iam.ImplicitProjectRoleForAccount(iam.AccountRole(userRole)); implicit != nil {
				projectRole = implicit
			}

			result := iam.Authorize(iam.AccountRole(userRole), projectRole, iam.AuthorizeTarget{
				Type: resourceType,
				ID:   resourceID,
			}, action)

			if !result.Allowed {
				http.Error(w, fmt.Sprintf(`{"error":"forbidden: %s"}`, result.Reason), http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}

func userIDFromContext(ctx context.Context) string {
	if v := ctx.Value("userID"); v != nil {
		return v.(string)
	}
	return ""
}

// chain composes middleware: chain(m1, m2)(h) == m1(m2(h))
func chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(final http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}

// validateBody wraps a handler to validate the JSON request body against a struct.
// Usage: validateBody(&MyStruct{}, handler) where MyStruct has validation tags.
// Only validates on POST/PUT/PATCH methods.
func validateBody(model interface{}) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost && r.Method != http.MethodPut && r.Method != http.MethodPatch {
				next.ServeHTTP(w, r)
				return
			}
			// Limit body size to prevent abuse (1MB)
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			var target interface{}
			switch v := model.(type) {
			case func() interface{}:
				target = v()
			default:
				target = model
			}
			if err := json.NewDecoder(r.Body).Decode(target); err != nil {
				http.Error(w, `{"error":"Invalid JSON body"}`, http.StatusBadRequest)
				return
			}
			// Store validated body in context for handler to retrieve
			ctx := context.WithValue(r.Context(), "validatedBody", target)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// validatedBody retrieves the validated request body from context.
func validatedBody(r *http.Request) interface{} {
	return r.Context().Value("validatedBody")
}

// getValidatedBody retrieves the validated body into a typed destination.
// Returns true if successful, false if not present or type mismatch.
func getValidatedBody(r *http.Request, dst interface{}) bool {
	v := r.Context().Value("validatedBody")
	if v == nil {
		return false
	}
	dstVal := reflect.ValueOf(dst)
	if dstVal.Kind() != reflect.Ptr {
		return false
	}
	srcVal := reflect.ValueOf(v)
	if !srcVal.Type().AssignableTo(dstVal.Type().Elem()) {
		return false
	}
	dstVal.Elem().Set(srcVal.Elem())
	return true
}

// Validation request types
type (
	generateArticleReq struct {
		Persona string `json:"persona" validate:"omitempty,max=50"`
	}
	
	credentialsReq struct {
		Service string `json:"service" validate:"required,max=100"`
		Token   string `json:"token" validate:"required,max=5000"`
	}
	
	adminSettingsReq struct {
		Settings map[string]string `json:"settings" validate:"required"`
	}
	
	createChatReq struct {
		Title string `json:"title" validate:"omitempty,max=200"`
	}
	
	updateChatReq struct {
		Title string `json:"title" validate:"required,max=200"`
	}
	
	sendMessageReq struct {
		Content string `json:"content" validate:"required,max=50000"`
		Model   string `json:"model" validate:"omitempty,max=100"`
	}
	
	trackReq struct {
		Slug  string `json:"slug" validate:"required,max=200"`
		Event string `json:"event" validate:"omitempty,max=50"`
	}
)

func NewServer(port string, db *storage.DB) *Server {
	s := &Server{
		db:     db,
		port:   port,
		mux:    http.NewServeMux(),
		agents: make(map[string]agentRun),
	}

	_ = jwtSecret() // fail fast at boot when JWT_SECRET is unset (S2)

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
		MetaKey:   os.Getenv("MODEL_API_KEY"),
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
		"MODEL_API_KEY":      "meta",
		"OPENAI_API_KEY":     "openai",
		"TAVILY_API_KEY":     "tavily",
		"FIRECRAWL_API_KEY":  "firecrawl",
	})
	// ponytail: gateway was built before credStore existed — link it now so PATCH /v1/credentials works for meta.
	s.llmGateway.CredStore = s.credStore

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
		"storage_mode":  s.db.StorageMode(),
		"article_count": s.db.ArticleCount(),
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

	// Wire real web retrieval into the epistemic retrieve node.
	// When Tavily or Firecrawl API keys are present, the retrieve node
	// will fetch live documents before calling the LLM. When keys are
	// absent, RealRetrieve stays nil and the pipeline falls back to
	// LLM-only mode (graceful degradation).
	if os.Getenv("TAVILY_API_KEY") != "" || os.Getenv("FIRECRAWL_API_KEY") != "" {
				agent.RealRetrieve = agent.RealRetrieveDocuments
		log.Printf("[veritas] real web retrieval enabled (Tavily/Firecrawl)")
	} else {
		log.Printf("[veritas] web retrieval offline — pipeline falling back to LLM-only mode")
	}

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
	// Rate limiters (local — one per Server, separate from package-level if any)
	authLimiter := newRateLimiter(10, time.Minute)  // 10 req/min for auth
	chatLimiter := newRateLimiter(30, time.Minute)   // 30 req/min for chat
	apiLimiter := newRateLimiter(60, time.Minute)    // 60 req/min for general API

	// Mount executor gateway routes.
	execHandler := &executor.Handler{Gateway: s.executorGateway}
	execHandler.RegisterRoutes(s.mux)

	// Mount LLM gateway routes.
	s.llmGateway.RegisterRoutes(s.mux)

	// Health - no auth, no rate limit (for load balancers)
	s.mux.Handle("/health", chain()(http.HandlerFunc(s.handleHealth)))

	// Auth endpoints - rate limited
	s.mux.Handle("/auth", chain(authLimiter.middleware)(http.HandlerFunc(s.handleAuthStub)))
	s.mux.Handle("/auth/login", chain(authLimiter.middleware)(http.HandlerFunc(s.handleAuthLogin)))
	s.mux.Handle("/auth/otp/request", chain(authLimiter.middleware)(http.HandlerFunc(s.handleOTPRequest)))
	s.mux.Handle("/auth/otp/verify", chain(authLimiter.middleware)(http.HandlerFunc(s.handleOTPVerify)))
	s.mux.Handle("/auth/password/register", chain(authLimiter.middleware)(http.HandlerFunc(s.handlePasswordRegister)))
	s.mux.Handle("/auth/password/login", chain(authLimiter.middleware)(http.HandlerFunc(s.handlePasswordLogin)))
	s.mux.Handle("/auth/me", chain(authLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleAuthMe)))
	s.mux.Handle("/auth/onboard", chain(authLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleAuthOnboard)))

	// Credential hot-swap - auth required + rate limited + body validation
	s.mux.Handle("/v1/credentials", chain(apiLimiter.middleware, s.authMiddleware, validateBody(credentialsReq{}))(http.HandlerFunc(s.handleCredentials)))

	// Stripe - auth required
	s.mux.Handle("/stripe", chain(apiLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleStripeRouter)))
	s.mux.Handle("/stripe/", chain(apiLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleStripeRouter)))

	// Quota, queue, track - auth required + validation
	s.mux.Handle("/quota", chain(apiLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleGetQuota)))
	s.mux.Handle("/queue", chain(apiLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleGetQueue)))
	s.mux.Handle("/track", chain(apiLimiter.middleware, s.authMiddleware, validateBody(trackReq{}))(http.HandlerFunc(s.handleTrack)))

	// Articles - top/search public read, generate/refresh/write auth + rate limited + validation
	s.mux.Handle("/articles/top", chain(apiLimiter.middleware, s.optionalAuthMiddleware)(http.HandlerFunc(s.handleGetTopArticles)))
	s.mux.Handle("/articles/search", chain(apiLimiter.middleware, s.optionalAuthMiddleware)(http.HandlerFunc(s.handleSearchArticles)))

	// Chat - auth required + rate limited
	chatAuth := chain(chatLimiter.middleware, s.authMiddleware)
	s.mux.Handle("/chat", chatAuth(http.HandlerFunc(s.handleChatRoot)))

	// Chat router needs special handling for sub-paths
	s.mux.Handle("/chat/", chatAuth(http.HandlerFunc(s.chatRouter)))

	// Maps - public read
	s.mux.Handle("/maps", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleMapsRoot)))
	s.mux.Handle("/maps/", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleMapsDynamicRoute)))

	// Claims - public read
	s.mux.Handle("/claims/", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleClaimEvidence)))

	// Gaps - aggregate view + engagement (upvote, submit evidence)
	s.mux.Handle("/gaps", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleGapsDynamicRoute)))
	s.mux.Handle("/gaps/", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleGapsDynamicRoute)))

	// Stale articles queue
	s.mux.Handle("/stale", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleGetStaleArticles)))

	// Contested claims - aggregate dashboard (public read)
	s.mux.Handle("/contested", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleGetContestedClaims)))

	// Global claim graph - cross-encyclopedia claim/evidence/relationship view
	s.mux.Handle("/claim-graph", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleGetGlobalClaimGraph)))

	// Live feed - per-article presence + global activity ticker (public SSE)
	s.mux.Handle("/live/now", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleGlobalLive)))

	// Admin - auth + admin role required + validation on PUT
	s.mux.Handle("/admin/settings", chain(apiLimiter.middleware, s.requireRole("admin", "admin", "settings", "write"), validateBody(adminSettingsReq{}))(http.HandlerFunc(s.handleAdminSettings)))

	// Webhook - HMAC verified in handler, no auth middleware
	s.mux.Handle("/webhook/", chain(apiLimiter.middleware)(http.HandlerFunc(s.handleWebhook)))

	// Start built-in daily refresh (always runs, regardless of manifest).
	s.startDailyRefresh()

	// Start cron scheduler if triggers are configured in manifest.
	if s.manifest != nil {
		triggers.StartScheduler(s.manifest.Triggers, s.triggerAction)
	}

	// Articles dynamic routes — GET reads are public (an encyclopedia must be
	// readable without login); POST writes (generate/refresh/resolve) are
	// gated inside the handler via requireCtxAuth.
	s.mux.Handle("/articles", chain(apiLimiter.middleware, s.optionalAuthMiddleware)(http.HandlerFunc(s.handleArticlesDynamicRoute)))
	s.mux.Handle("/articles/", chain(apiLimiter.middleware, s.optionalAuthMiddleware)(http.HandlerFunc(s.handleArticlesDynamicRoute)))
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

// startDailyRefresh runs a goroutine that checks for stale articles every 24h.
func (s *Server) startDailyRefresh() {
	go func() {
		// Fire once on boot after a short delay.
		time.Sleep(30 * time.Second)
		s.refreshStaleArticles()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			s.refreshStaleArticles()
		}
	}()
}

// refreshStaleArticles queries for articles whose claims have low freshness
// and re-generates them via the session engine.
func (s *Server) refreshStaleArticles() {
	log.Printf("[refresh] checking for stale articles")
	articles, err := s.db.ListArticles(0, 100)
	if err != nil {
		log.Printf("[refresh] list articles: %v", err)
		return
	}
	var refreshed int
	for _, a := range articles {
		claims, err := s.db.GetClaimsByArticle(a.Slug)
		if err != nil {
			continue
		}
		if len(claims) == 0 {
			continue
		}
		var totalScore float64
		for _, cl := range claims {
			info, err := s.db.ComputeClaimFreshness(cl.ID)
			if err != nil {
				continue
			}
			totalScore += info.FreshnessScore
		}
		avg := totalScore / float64(len(claims))
		if avg < 0.4 {
			log.Printf("[refresh] stale article: slug=%s freshness=%.2f, re-generating", a.Slug, avg)
			s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
				Slug:    a.Slug,
				Persona: "veritas",
				Source:  "trigger:refresh",
			})
			refreshed++
		}
	}
	log.Printf("[refresh] done — %d/%d stale articles refreshed", refreshed, len(articles))
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
	case "refresh_stale":
		s.refreshStaleArticles()
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

// handleAuthLogin is OTP-only since S1: it emails a login code and returns
// {"sent":true}. The JWT is issued by /auth/otp/verify, never here.
func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "login")
	s.requestOTPCode(w, r)
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
			if !requireCtxAuth(w, r) {
				return
			}
			_ = validatedBody(r)
			s.handleGenerateArticle(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "refresh":
		if r.Method == "POST" {
			if !requireCtxAuth(w, r) {
				return
			}
			_ = validatedBody(r)
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
			if !requireCtxAuth(w, r) {
				return
			}
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
	case "claims":
		if r.Method == "GET" {
			s.handleArticleClaims(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "gaps":
		if r.Method == "GET" {
			s.handleArticleGaps(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "freshness":
		if r.Method == "GET" {
			s.handleArticleFreshness(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "refresh-diff":
		if r.Method == "GET" {
			s.handleRefreshDiff(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "graph":
		if r.Method == "GET" {
			s.handleGetArticleGraph(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "claim-graph":
		if r.Method == "GET" {
			s.handleArticleClaimGraph(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "epistemic":
		if r.Method == "GET" {
			s.handleArticleEpistemic(w, r, slug)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	case "live":
		if r.Method == "GET" {
			s.handleArticleLive(w, r)
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
