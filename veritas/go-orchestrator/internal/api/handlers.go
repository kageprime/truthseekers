package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
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

func (s *Server) handleArticleClaims(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "article claims slug=%s", slug)
	claims, err := s.db.GetClaimsByArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"claims": claims})
}

func (s *Server) handleArticleGaps(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "article gaps slug=%s", slug)
	gaps, err := s.db.GetGapsByArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"gaps": gaps})
}

func (s *Server) handleClaimEvidence(w http.ResponseWriter, r *http.Request) {
	// Path: /claims/{id}/evidence
	path := strings.TrimPrefix(r.URL.Path, "/claims/")
	path = strings.TrimSuffix(path, "/evidence")
	claimID := strings.TrimSuffix(path, "/")
	reqLog(r, "claim evidence id=%s", claimID)
	evidence, err := s.db.GetEvidenceByClaim(claimID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"evidence": evidence})
}

func (s *Server) handleArticleFreshness(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "article freshness slug=%s", slug)
	claims, err := s.db.GetClaimsByArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	type cf struct {
		ClaimID         string  `json:"claim_id"`
		Text            string  `json:"text"`
		FreshnessScore  float64 `json:"freshness_score"`
		EvidenceCount   int     `json:"evidence_count"`
	}
	var claimFreshness []cf
	var totalScore float64
	for _, cl := range claims {
		info, err := s.db.ComputeClaimFreshness(cl.ID)
		if err != nil {
			continue
		}
		claimFreshness = append(claimFreshness, cf{
			ClaimID:        cl.ID,
			Text:           cl.Text,
			FreshnessScore: info.FreshnessScore,
			EvidenceCount:  info.EvidenceCount,
		})
		totalScore += info.FreshnessScore
	}
	overall := 0.5
	if len(claims) > 0 {
		overall = totalScore / float64(len(claims))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"slug":           slug,
		"overall_score":  overall,
		"claim_freshness": claimFreshness,
	})
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

	// Article crossref edges
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

	// Claim nodes for this article
	claims, err := s.db.GetClaimsByArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Build nodes + edges for force-directed graph
	var nodes []map[string]interface{}
	linkSet := make(map[string]bool)

	// Article node
	nodes = append(nodes, map[string]interface{}{
		"id": slug, "type": "article", "label": slug,
	})

	// Claim nodes linked to article
	for _, c := range claims {
		nodes = append(nodes, map[string]interface{}{
			"id": c.ID, "type": "claim", "label": c.Text,
			"status": c.Status, "confidence": c.DerivedConfidence,
		})
		key := slug + "|" + c.ID
		if !linkSet[key] {
			linkSet[key] = true
		}
	}

	// Build links from article→claim and crossref edges
	var links []map[string]interface{}
	for c := range linkSet {
		parts := strings.SplitN(c, "|", 2)
		links = append(links, map[string]interface{}{
			"source": parts[0], "target": parts[1], "type": "contains",
		})
	}
	for _, e := range edges {
		links = append(links, map[string]interface{}{
			"source": e.Source, "target": e.Target, "type": e.Relationship,
		})
	}
	for _, e := range backlinks {
		links = append(links, map[string]interface{}{
			"source": e.Source, "target": e.Target, "type": e.Relationship,
		})
	}

	response := map[string]interface{}{
		"nodes": nodes,
		"links": links,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleArticleClaimGraph returns a claim-level graph for an article: claim,
// evidence, and source nodes joined by typed edges (evidence→claim supports /
// contradicts, plus claim→claim relationships from the resolve node).
func (s *Server) handleArticleClaimGraph(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "article claim graph slug=%s", slug)
	claims, err := s.db.GetClaimsByArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	rels, err := s.db.GetClaimRelationships(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var nodes []map[string]interface{}
	edges := []map[string]interface{}{}
	seen := make(map[string]bool)

	for _, c := range claims {
		if !seen["claim|"+c.ID] {
			nodes = append(nodes, map[string]interface{}{
				"id": c.ID, "type": "claim", "label": c.Text,
				"status": c.Status, "confidence": c.DerivedConfidence,
				"confidence_vector": c.ConfidenceVector,
			})
			seen["claim|"+c.ID] = true
		}
		evs, _ := s.db.GetEvidenceByClaim(c.ID)
		for _, e := range evs {
			if !seen["evidence|"+e.ID] {
				nodes = append(nodes, map[string]interface{}{
					"id":    e.ID,
					"type":  "evidence",
					"label": e.URL,
					"supports":           e.SupportsClaim,
					"chain_of_custody":   e.ChainOfCustody,
					"accessibility":      e.Accessibility,
				})
				seen["evidence|"+e.ID] = true
			}
			rel := "contradicts"
			if e.SupportsClaim {
				rel = "supports"
			}
			edges = append(edges, map[string]interface{}{
				"source": e.ID, "target": c.ID,
				"type": "evidence", "relationship": rel,
			})
		}
	}

	for _, rel := range rels {
		edges = append(edges, map[string]interface{}{
			"source": rel.SourceClaimID, "target": rel.TargetClaimID,
			"type": "claim", "relationship": rel.RelationshipType, "strength": rel.Strength,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"nodes": nodes, "edges": edges})
}

// handleGetContestedClaims returns the most contested claims across the whole
// encyclopedia (disputed/weak, ranked by contradiction level) for the
// /contested dashboard.
func (s *Server) handleGetContestedClaims(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "contested claims")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	claims, err := s.db.GetMostContestedClaims(limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"claims": claims})
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

func (s *Server) handleGetAllGaps(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "get all gaps")
	gaps, err := s.db.GetAllEvidenceGapsWithClaims()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"gaps": gaps})
}

func (s *Server) handleUpvoteGap(w http.ResponseWriter, r *http.Request) {
	// Path: /gaps/{id}/upvote
	path := strings.TrimPrefix(r.URL.Path, "/gaps/")
	gapID := strings.TrimSuffix(path, "/upvote")
	gapID = strings.TrimSuffix(gapID, "/")
	reqLog(r, "upvote gap id=%s", gapID)
	userID := userIDFromRequest(r)
	if userID == "" {
		userID = "anonymous"
	}
	if err := s.db.UpvoteGap(gapID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	count, _ := s.db.GetGapUpvoteCount(gapID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"gap_id": gapID, "upvotes": count})
}

func (s *Server) handleSubmitGapEvidence(w http.ResponseWriter, r *http.Request) {
	// Path: /gaps/{id}/submit
	path := strings.TrimPrefix(r.URL.Path, "/gaps/")
	gapID := strings.TrimSuffix(path, "/submit")
	gapID = strings.TrimSuffix(gapID, "/")
	reqLog(r, "submit gap evidence id=%s", gapID)
	var body struct {
		URL  string `json:"url"`
		Note string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		http.Error(w, `{"error":"url is required"}`, http.StatusBadRequest)
		return
	}
	userID := userIDFromRequest(r)
	if userID == "" {
		userID = "anonymous"
	}
	sub, err := s.db.SubmitGapEvidence(gapID, body.URL, body.Note, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sub)
}

func (s *Server) handleRefreshDiff(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "refresh diff slug=%s", slug)
	diff, err := s.db.GetRefreshDiff(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if diff == nil {
		diff = map[string]interface{}{
			"slug": slug, "total_claims": 0, "upgraded": 0,
			"downgraded": 0, "status_changed": 0, "claim_diffs": []interface{}{},
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(diff)
}

func (s *Server) handleGetStaleArticles(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "stale articles")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	articles, err := s.db.GetStaleArticles(limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"articles": articles})
}

// handleGapsDynamicRoute dispatches gap sub-routes:
//   GET  /gaps              → list all gaps (enriched with claim text)
//   POST /gaps/{id}/upvote  → upvote a gap
//   POST /gaps/{id}/submit  → submit community evidence for a gap
func (s *Server) handleGapsDynamicRoute(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/gaps")
	path = strings.TrimPrefix(path, "/")
	if path == "" {
		// GET /gaps
		if r.Method == "GET" {
			s.handleGetAllGaps(w, r)
			return
		}
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// /gaps/{id}/{action}
	parts := strings.Split(path, "/")
	if len(parts) >= 2 {
		action := parts[len(parts)-1]
		switch action {
		case "upvote":
			if r.Method == "POST" {
				s.handleUpvoteGap(w, r)
				return
			}
		case "submit":
			if r.Method == "POST" {
				s.handleSubmitGapEvidence(w, r)
				return
			}
		}
	}
	http.NotFound(w, r)
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

