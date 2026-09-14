package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Live activity layer — makes episodes feel broadcast.
//
// Two SSE surfaces:
//   - GET /articles/:slug/live   → per-article live state (viewers, phase, last event)
//   - GET /live/now              → global activity ticker (what's happening right now)
//
// State is kept in-memory; the existing BroadcastProgress is the only producer.
// This adds presence tracking and a cross-slug activity ring without touching
// the pipeline or storage layer.
//
// ponytail: in-memory only, lost on restart. If persistence matters later,
// hydrate the global ring from the most recent progress events in the DB.

// ── Per-article live state ──────────────────────────────────────────────

type liveEntry struct {
	mu          sync.RWMutex
	viewers     int
	phase       string
	lastEvent   string
	lastEventAt time.Time
	createdAt   time.Time
	slug        string
}

type livePayload struct {
	Slug        string `json:"slug"`
	Viewers     int    `json:"viewers"`
	Phase       string `json:"phase"`
	LastEvent   string `json:"lastEvent"`
	LastEventAt string `json:"lastEventAt"`
	Live        bool   `json:"live"`
}

const liveRecentWindow = 90 * time.Second

// ── Global activity ring (drives the /live/now ticker) ──────────────────

type activityItem struct {
	Slug  string `json:"slug"`
	Phase string `json:"phase"`
	Kind  string `json:"kind"`
	Text  string `json:"text"`
	At    string `json:"at"`
}

const maxGlobalActivity = 30

// ── SSE handlers ────────────────────────────────────────────────────────

func (s *Server) handleArticleLive(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	// /articles/{slug}/live
	const prefix = "/articles/"
	const suffix = "/live"
	if len(path) <= len(prefix)+len(suffix) {
		http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
		return
	}
	slug := path[len(prefix) : len(path)-len(suffix)]

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := make(chan string, 16)
	// S17: cap watchers per slug — unbounded fanout is a memory/CPU DoS.
	s.sse.liveSubsMu.Lock()
	if len(s.sse.liveSubs[slug]) >= maxLiveSubsPerSlug {
		s.sse.liveSubsMu.Unlock()
		http.Error(w, `{"error":"too many watchers"}`, http.StatusTooManyRequests)
		return
	}
	s.sse.liveSubs[slug] = append(s.sse.liveSubs[slug], ch)
	s.sse.liveSubsMu.Unlock()
	s.sse.bumpViewers(slug, 1)

	// Initial snapshot.
	raw, _ := json.Marshal(s.sse.snapshotLive(slug))
	fmt.Fprintf(w, "event: live\ndata: %s\n\n", string(raw))
	flusher.Flush()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			// ponytail: unlock BEFORE bumpViewers — it fans out, which takes
			// liveSubsMu.RLock. RWMutex isn't reentrant: Lock→RLock on one
			// goroutine deadlocks, wedging every future /articles/:slug/live
			// at registration (zero bytes, browser reports it as a CORS error).
			s.sse.liveSubsMu.Lock()
			chans := s.sse.liveSubs[slug]
			for i, c := range chans {
				if c == ch {
					s.sse.liveSubs[slug] = append(chans[:i], chans[i+1:]...)
					break
				}
			}
			if len(s.sse.liveSubs[slug]) == 0 {
				delete(s.sse.liveSubs, slug)
			}
			s.sse.liveSubsMu.Unlock()
			s.sse.bumpViewers(slug, -1)
			return
		case payload := <-ch:
			fmt.Fprint(w, payload)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprint(w, ":heartbeat\n\n")
			flusher.Flush()
			// Also re-broadcast a snapshot so the recent-window `live` flag
			// flips back to false after the activity window expires.
			s.sse.fanoutLive(slug)
		}
	}
}

func (s *Server) handleGlobalLive(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := make(chan string, 8)
	s.sse.globMu.Lock()
	// S17: cap global ticker subscribers.
	if len(s.sse.globalSubs) >= maxGlobalSubs {
		s.sse.globMu.Unlock()
		http.Error(w, `{"error":"too many watchers"}`, http.StatusTooManyRequests)
		return
	}
	s.sse.globalSubs = append(s.sse.globalSubs, ch)
	s.sse.globMu.Unlock()

	raw, _ := json.Marshal(s.sse.snapshotGlobal())
	fmt.Fprintf(w, "event: activity\ndata: %s\n\n", string(raw))
	flusher.Flush()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			s.sse.globMu.Lock()
			defer s.sse.globMu.Unlock()
			chans := s.sse.globalSubs
			for i, c := range chans {
				if c == ch {
					s.sse.globalSubs = append(chans[:i], chans[i+1:]...)
					break
				}
			}
			return
		case payload := <-ch:
			fmt.Fprint(w, payload)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprint(w, ":heartbeat\n\n")
			flusher.Flush()
		}
	}
}
