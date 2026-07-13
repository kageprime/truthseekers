package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
)

// Active SSE channel registries for real-time progress updates
var (
	progressChannels   = make(map[string][]chan string)
	progressChannelsMu sync.RWMutex
	progressRing       = make(map[string][]string) // ring buffer per slug, replayed to late joiners
	progressRingMu     sync.RWMutex
)

const maxRingEvents = 50

// BroadcastProgress sends an SSE payload to all listening clients for a slug.
func BroadcastProgress(slug string, event string, data interface{}) {
	progressChannelsMu.RLock()
	chans, ok := progressChannels[slug]
	progressChannelsMu.RUnlock()

	if !ok || len(chans) == 0 {
		return
	}

	rawJSON, err := json.Marshal(data)
	if err != nil {
		return
	}

	payload := fmt.Sprintf("event: %s\ndata: %s\n\n", event, string(rawJSON))

	// Store in ring buffer for late-joining subscribers
	progressRingMu.Lock()
	ring := progressRing[slug]
	ring = append(ring, payload)
	if len(ring) > maxRingEvents {
		ring = ring[len(ring)-maxRingEvents:]
	}
	progressRing[slug] = ring
	progressRingMu.Unlock()

	// Send to all subscribers non-blockingly
	for _, ch := range chans {
		select {
		case ch <- payload:
		default:
		}
	}
}

func registerProgressChannel(slug string, ch chan string) {
	progressChannelsMu.Lock()
	defer progressChannelsMu.Unlock()
	progressChannels[slug] = append(progressChannels[slug], ch)
}

func unregisterProgressChannel(slug string, ch chan string) {
	progressChannelsMu.Lock()
	defer progressChannelsMu.Unlock()
	chans := progressChannels[slug]
	for i, c := range chans {
		if c == ch {
			progressChannels[slug] = append(chans[:i], chans[i+1:]...)
			break
		}
	}
	if len(progressChannels[slug]) == 0 {
		delete(progressChannels, slug)
		progressRingMu.Lock()
		delete(progressRing, slug)
		progressRingMu.Unlock()
	}
}

func (s *Server) handleListArticles(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "list articles")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	offset := 0
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	articles, err := s.db.ListArticles(limit+1, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	hasMore := len(articles) > limit
	if hasMore {
		articles = articles[:limit]
	}

	var nextOffset *int
	if hasMore {
		nextVal := offset + limit
		nextOffset = &nextVal
	}

	response := map[string]interface{}{
		"data": articles,
		"pagination": map[string]interface{}{
			"limit":      limit,
			"offset":     offset,
			"hasMore":    hasMore,
			"nextOffset": nextOffset,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleSearchArticles(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "search articles")
	q := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")

	limit := 10
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	if q == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}

	articles, err := s.db.SearchArticles(q, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(articles)
}

func (s *Server) handleGetArticle(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "get article slug=%s", slug)
	article, err := s.db.GetArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if article == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error": "Article not found", "status": "not_generated"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(article)
}

func (s *Server) handleGetArticleStatus(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "get article status slug=%s", slug)
	job, err := s.db.GetJob(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if job == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "not_found"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

type GenerateRequest struct {
	Persona string `json:"persona"`
}

func (s *Server) handleGenerateArticle(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "generate article slug=%s", slug)
	var req GenerateRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Persona == "" {
		req.Persona = "veritas"
	}

	// Double check if already exists
	existing, _ := s.db.GetArticle(slug)
	if existing != nil && existing.Metadata.Status == "published" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(fmt.Sprintf(`{"status":"already_exists","slug":"%s"}`, slug)))
		return
	}

	userID := userIDFromRequest(r)

	// Enqueue through the session lifecycle engine. CreateSession dedupes by
	// slug and applies backpressure.
	_, err := s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
		Slug:    slug,
		UserID:  userID,
		Persona: req.Persona,
		Source:  "ui",
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(fmt.Sprintf(`{"status":"busy","slug":"%s","error":"%s"}`, slug, err.Error())))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(fmt.Sprintf(`{"status":"queued","slug":"%s","persona":"%s"}`, slug, req.Persona)))
}

func (s *Server) handleRefreshArticle(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "refresh article slug=%s", slug)
	userID := userIDFromRequest(r)
	_, err := s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
		Slug:    slug,
		UserID:  userID,
		Persona: "veritas",
		Source:  "ui",
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(fmt.Sprintf(`{"status":"busy","slug":"%s","error":"%s"}`, slug, err.Error())))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(fmt.Sprintf(`{"status":"queued","slug":"%s"}`, slug)))
}

func (s *Server) handleExportArticle(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "export article slug=%s", slug)
	article, err := s.db.GetArticle(slug)
	if err != nil || article == nil {
		http.Error(w, "Article not found", http.StatusNotFound)
		return
	}

	format := r.URL.Query().Get("format")
	if format == "markdown" {
		w.Header().Set("Content-Type", "text/markdown")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.md"`, slug))
		w.Write([]byte(article.Abstract))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(article)
}

func (s *Server) handleResolveArticle(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "resolve article slug=%s", slug)
	// HITL Resolve Webhook stub
	var body map[string]string
	_ = json.NewDecoder(r.Body).Decode(&body)
	action := body["action"]

	_ = s.db.SaveJob(slug, "writing", "write", map[string]interface{}{"action": action})

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"status":"resolved","action":"%s"}`, action)))
}

func (s *Server) handleGetArticleViews(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "get article views slug=%s", slug)
	count, err := s.db.GetArticleViewCount(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"slug":"%s","views":%d}`, slug, count)))
}

func (s *Server) handleGetArticleGraph(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "get article graph slug=%s", slug)
	edges, err := s.db.GetGraphEdges(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	backlinks, err := s.db.GetBacklinks(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"edges":     edges,
		"backlinks": backlinks,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleGetQuota(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "quota")
	// Mock quota handler returning default high-limit. The frontend's QuotaInfo
	// requires `remaining`, so compute it as limit-used.
	const (
		limit = 100
		used  = 2
	)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"allowed":true,"limit":%d,"used":%d,"remaining":%d,"tier":"pro"}`, limit, used, limit-used)
}

func (s *Server) handleGetQueue(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "queue")
	// Mock queue summary returning empty queue
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"jobs":[],"stats":{"active":0,"queued":0,"completed":0}}`))
}

func (s *Server) handleTrack(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "track")
	var body map[string]string
	_ = json.NewDecoder(r.Body).Decode(&body)
	slug := body["slug"]
	event := body["event"]
	if event == "" {
		event = "view"
	}
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}

	_ = s.db.TrackArticleView(slug, ip, event)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"tracked"}`))
}

func (s *Server) handleGetTopArticles(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "top articles")
	limitStr := r.URL.Query().Get("limit")
	limit := 10
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	articles, err := s.db.GetTopArticles(limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"data": articles,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleGetArticleProgress streams SSE progress events to the frontend.
func (s *Server) handleGetArticleProgress(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "article progress slug=%s", slug)
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := make(chan string, 10)
	registerProgressChannel(slug, ch)
	defer unregisterProgressChannel(slug, ch)

	// Replay ring buffer for late-joining subscribers
	progressRingMu.RLock()
	ring := progressRing[slug]
	progressRingMu.RUnlock()
	for _, msg := range ring {
		w.Write([]byte(msg))
		flusher.Flush()
	}

	// Stream initial heartbeat or status
	fmt.Fprintf(w, "event: heartbeat\ndata: {\"time\": %d}\n\n", time.Now().Unix())
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			w.Write([]byte(msg))
			flusher.Flush()
		case <-time.After(15 * time.Second):
			// Keep-alive heartbeat
			fmt.Fprintf(w, "event: heartbeat\ndata: {\"time\": %d}\n\n", time.Now().Unix())
			flusher.Flush()
		}
	}
}

