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
	slug        string
}

var (
	liveMu      sync.RWMutex
	liveStates  = make(map[string]*liveEntry)
	liveSubs    = make(map[string][]chan string)
	liveSubsMu  sync.RWMutex
)

type livePayload struct {
	Slug        string `json:"slug"`
	Viewers     int    `json:"viewers"`
	Phase       string `json:"phase"`
	LastEvent   string `json:"lastEvent"`
	LastEventAt string `json:"lastEventAt"`
	Live        bool   `json:"live"`
}

const liveRecentWindow = 90 * time.Second

// getOrCreateLive returns (or creates) the live state entry for a slug.
func getOrCreateLive(slug string) *liveEntry {
	liveMu.Lock()
	defer liveMu.Unlock()
	if e, ok := liveStates[slug]; ok {
		return e
	}
	e := &liveEntry{slug: slug}
	liveStates[slug] = e
	return e
}

// markActivity is the single producer hook — called from BroadcastProgress so
// every phase/event tick from the pipeline also flips the live state.
func markActivity(slug, phase, lastEvent string) {
	e := getOrCreateLive(slug)
	e.mu.Lock()
	if phase != "" {
		e.phase = phase
	}
	if lastEvent != "" {
		e.lastEvent = lastEvent
		e.lastEventAt = time.Now()
	} else if phase != "" {
		// Phase ticks are themselves activity; bump the timestamp so a long
		// pipeline (no discrete events) still shows the article as live.
		e.lastEventAt = time.Now()
	}
	e.mu.Unlock()
	fanoutLive(slug)
}

// bumpViewers adjusts the per-slug viewer count. delta is +1 on connect,
// -1 on disconnect.
func bumpViewers(slug string, delta int) {
	e := getOrCreateLive(slug)
	e.mu.Lock()
	e.viewers += delta
	if e.viewers < 0 {
		e.viewers = 0
	}
	e.mu.Unlock()
	fanoutLive(slug)
}

// snapshotLive returns the current live payload for a slug.
func snapshotLive(slug string) livePayload {
	e := getOrCreateLive(slug)
	e.mu.RLock()
	defer e.mu.RUnlock()
	live := false
	if e.viewers > 0 {
		live = true
	} else if !e.lastEventAt.IsZero() && time.Since(e.lastEventAt) < liveRecentWindow {
		live = true
	}
	ts := ""
	if !e.lastEventAt.IsZero() {
		ts = e.lastEventAt.UTC().Format(time.RFC3339)
	}
	return livePayload{
		Slug:        slug,
		Viewers:     e.viewers,
		Phase:       e.phase,
		LastEvent:   e.lastEvent,
		LastEventAt: ts,
		Live:        live,
	}
}

// fanoutLive pushes the current snapshot to all SSE subscribers of a slug.
func fanoutLive(slug string) {
	snap := snapshotLive(slug)
	raw, err := json.Marshal(snap)
	if err != nil {
		return
	}
	payload := "event: live\ndata: " + string(raw) + "\n\n"
	liveSubsMu.RLock()
	chans := liveSubs[slug]
	liveSubsMu.RUnlock()
	for _, ch := range chans {
		select {
		case ch <- payload:
		default:
		}
	}
}

// ── Global activity ring (drives the /live/now ticker) ──────────────────

type activityItem struct {
	Slug  string `json:"slug"`
	Phase string `json:"phase"`
	Kind  string `json:"kind"`
	Text  string `json:"text"`
	At    string `json:"at"`
}

const maxGlobalActivity = 30

var (
	globalActivityMu sync.RWMutex
	globalActivity   = make([]activityItem, 0, maxGlobalActivity)
)

func pushActivity(slug, kind, phase, text string) {
	item := activityItem{
		Slug:  slug,
		Kind:  kind,
		Phase: phase,
		Text:  text,
		At:    time.Now().UTC().Format(time.RFC3339),
	}
	globalActivityMu.Lock()
	globalActivity = append(globalActivity, item)
	if len(globalActivity) > maxGlobalActivity {
		globalActivity = globalActivity[len(globalActivity)-maxGlobalActivity:]
	}
	globalActivityMu.Unlock()
	fanoutGlobal()
}

func snapshotGlobal() []activityItem {
	globalActivityMu.RLock()
	defer globalActivityMu.RUnlock()
	out := make([]activityItem, len(globalActivity))
	copy(out, globalActivity)
	return out
}

// ── Global subscribers ──────────────────────────────────────────────────

var (
	globalSubsMu sync.RWMutex
	globalSubs   []chan string
)

func fanoutGlobal() {
	items := snapshotGlobal()
	raw, _ := json.Marshal(items)
	payload := "event: activity\ndata: " + string(raw) + "\n\n"
	globalSubsMu.RLock()
	defer globalSubsMu.RUnlock()
	for _, ch := range globalSubs {
		select {
		case ch <- payload:
		default:
		}
	}
}

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
	liveSubsMu.Lock()
	liveSubs[slug] = append(liveSubs[slug], ch)
	liveSubsMu.Unlock()
	bumpViewers(slug, 1)

	// Initial snapshot.
	raw, _ := json.Marshal(snapshotLive(slug))
	fmt.Fprintf(w, "event: live\ndata: %s\n\n", string(raw))
	flusher.Flush()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			liveSubsMu.Lock()
			defer liveSubsMu.Unlock()
			bumpViewers(slug, -1)
			chans := liveSubs[slug]
			for i, c := range chans {
				if c == ch {
					liveSubs[slug] = append(chans[:i], chans[i+1:]...)
					break
				}
			}
			if len(liveSubs[slug]) == 0 {
				delete(liveSubs, slug)
			}
			return
		case payload := <-ch:
			fmt.Fprint(w, payload)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprint(w, ":heartbeat\n\n")
			flusher.Flush()
			// Also re-broadcast a snapshot so the recent-window `live` flag
			// flips back to false after the activity window expires.
			fanoutLive(slug)
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
	globalSubsMu.Lock()
	globalSubs = append(globalSubs, ch)
	globalSubsMu.Unlock()

	raw, _ := json.Marshal(snapshotGlobal())
	fmt.Fprintf(w, "event: activity\ndata: %s\n\n", string(raw))
	flusher.Flush()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			globalSubsMu.Lock()
			defer globalSubsMu.Unlock()
			chans := globalSubs
			for i, c := range chans {
				if c == ch {
					globalSubs = append(chans[:i], chans[i+1:]...)
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
