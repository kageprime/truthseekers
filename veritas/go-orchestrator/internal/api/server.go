package api

import (
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
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

var startTime = time.Now()

// issueToken signs a real HS256 JWT for the given user id (subject).
// Replaces the old unsigned alg:none mockJWT.
func issueToken(sub string) string {
	tok, err := signJWT(sub)
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
	queue  *GenerationQueue

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
	s.queue = NewGenerationQueue(s)
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

// Queue exposes the generation worker pool so main.go can Restore() on boot
// and Stop() on shutdown.
func (s *Server) Queue() *GenerationQueue {
	return s.queue
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	active, queued := s.queue.Stats()
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

func (s *Server) setupRoutes() {
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

	token := issueToken(user.ID)
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
