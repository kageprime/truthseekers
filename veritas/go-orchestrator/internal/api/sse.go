package api

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"
)

// SSE hub — owns every streaming registry that used to be a package global.
// Per-Server so tests and future instances never share watchers, and every
// progress frame carries a monotonic id: so EventSource reconnects resume
// via Last-Event-ID instead of silently missing the middle.
//
// ponytail: one hub, not one per stream. Four fan-out maps already existed;
// unifying further (single multiplexed connection) waits for frontend work.

const (
	maxRingEvents          = 50
	maxProgressSubsPerSlug = 100
	maxLiveSubsPerSlug     = 100
	maxGlobalSubs          = 1000
	liveEntryTTL           = 10 * time.Minute
	sseSweepInterval       = 60 * time.Second
)

type ringFrame struct {
	id    uint64
	event string
	frame string
}

type sseHub struct {
	mu   sync.RWMutex
	subs map[string][]chan string
	ring map[string][]ringFrame
	seq  map[string]uint64

	liveMu sync.RWMutex
	live   map[string]*liveEntry

	liveSubs   map[string][]chan string
	liveSubsMu sync.RWMutex

	actMu    sync.RWMutex
	activity []activityItem

	globMu     sync.RWMutex
	globalSubs []chan string

	done chan struct{}
	once sync.Once
}

func newSSEHub() *sseHub {
	h := &sseHub{
		subs:     make(map[string][]chan string),
		ring:     make(map[string][]ringFrame),
		seq:      make(map[string]uint64),
		live:     make(map[string]*liveEntry),
		liveSubs: make(map[string][]chan string),
		activity: make([]activityItem, 0, maxGlobalActivity),
		done:     make(chan struct{}),
	}
	go h.sweepLoop()
	return h
}

func (h *sseHub) Stop() {
	h.once.Do(func() { close(h.done) })
}

// broadcast sends an SSE payload to all slug watchers. The ring is ALWAYS
// written (even with zero subscribers) so late joiners and reconnects replay
// — the old early-return made post-gap refreshes heartbeat-only.
func (h *sseHub) broadcast(slug string, event string, data interface{}) {
	rawJSON, err := json.Marshal(data)
	if err != nil {
		return
	}

	h.mu.Lock()
	h.seq[slug]++
	id := h.seq[slug]
	frame := fmt.Sprintf("id: %d\nevent: %s\ndata: %s\n\n", id, event, string(rawJSON))
	ring := append(h.ring[slug], ringFrame{id: id, event: event, frame: frame})
	if len(ring) > maxRingEvents {
		ring = ring[len(ring)-maxRingEvents:]
	}
	h.ring[slug] = ring
	chans := h.subs[slug]
	h.mu.Unlock()

	// Live-feed hooks: every progress tick is also live activity. No-ops
	// when nobody is subscribed, so the hot path stays cheap.
	phase, text := extractLiveSignal(event, data)
	if phase != "" || text != "" {
		h.markActivity(slug, phase, text)
		h.pushActivity(slug, event, phase, text)
	}

	// Send to all subscribers non-blockingly (slow consumers drop, but can
	// resume from the ring via Last-Event-ID instead of diverging silently).
	for _, ch := range chans {
		select {
		case ch <- frame:
		default:
		}
	}
}

// replaySince returns ring frames newer than lastID. Anonymous callers only
// ever see completion — progress carries claim text and sources.
func (h *sseHub) replaySince(slug string, lastID uint64, authed bool) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var out []string
	for _, f := range h.ring[slug] {
		if f.id <= lastID {
			continue
		}
		if !authed && f.event != "article_complete" {
			continue
		}
		out = append(out, f.frame)
	}
	return out
}

func (h *sseHub) registerProgress(slug string, ch chan string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.subs[slug]) >= maxProgressSubsPerSlug {
		return false
	}
	h.subs[slug] = append(h.subs[slug], ch)
	return true
}

func (h *sseHub) unregisterProgress(slug string, ch chan string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	chans := h.subs[slug]
	for i, c := range chans {
		if c == ch {
			h.subs[slug] = append(chans[:i], chans[i+1:]...)
			break
		}
	}
	if len(h.subs[slug]) == 0 {
		delete(h.subs, slug)
		// ponytail: ring intentionally survives zero watchers — deleting it
		// here was the "refresh mid-generation gets heartbeat only" bug.
		// The sweeper reclaims idle slugs.
	}
}

// sseEventName pulls the event off a framed payload ("id:\nevent:\ndata:").
func sseEventName(frame string) string {
	for _, line := range strings.Split(frame, "\n") {
		if v, ok := strings.CutPrefix(line, "event: "); ok {
			return v
		}
	}
	return ""
}

// lastEventID parses the EventSource reconnect cursor. Garbage means
// full replay — fail open toward more context, never less.
func lastEventID(v string) uint64 {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0
	}
	n, err := strconv.ParseUint(v, 10, 64)
	if err != nil {
		return 0
	}
	return n
}

// ── Live presence (per-article viewers + phase) ──────────────────────────

func (h *sseHub) getOrCreateLive(slug string) *liveEntry {
	h.liveMu.Lock()
	defer h.liveMu.Unlock()
	if e, ok := h.live[slug]; ok {
		return e
	}
	e := &liveEntry{slug: slug, createdAt: time.Now()}
	h.live[slug] = e
	return e
}

// markActivity is the single producer hook — every pipeline tick flips live state.
func (h *sseHub) markActivity(slug, phase, lastEvent string) {
	e := h.getOrCreateLive(slug)
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
	h.fanoutLive(slug)
}

// bumpViewers adjusts the per-slug viewer count. +1 on connect, -1 on disconnect.
func (h *sseHub) bumpViewers(slug string, delta int) {
	e := h.getOrCreateLive(slug)
	e.mu.Lock()
	e.viewers += delta
	if e.viewers < 0 {
		e.viewers = 0
	}
	e.mu.Unlock()
	h.fanoutLive(slug)
}

func (h *sseHub) snapshotLive(slug string) livePayload {
	e := h.getOrCreateLive(slug)
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

func (h *sseHub) fanoutLive(slug string) {
	snap := h.snapshotLive(slug)
	raw, err := json.Marshal(snap)
	if err != nil {
		return
	}
	payload := "event: live\ndata: " + string(raw) + "\n\n"
	h.liveSubsMu.RLock()
	chans := h.liveSubs[slug]
	h.liveSubsMu.RUnlock()
	for _, ch := range chans {
		select {
		case ch <- payload:
		default:
		}
	}
}

// ── Global activity ring + subscribers ───────────────────────────────────

func (h *sseHub) pushActivity(slug, kind, phase, text string) {
	item := activityItem{
		Slug:  slug,
		Kind:  kind,
		Phase: phase,
		Text:  text,
		At:    time.Now().UTC().Format(time.RFC3339),
	}
	h.actMu.Lock()
	h.activity = append(h.activity, item)
	if len(h.activity) > maxGlobalActivity {
		h.activity = h.activity[len(h.activity)-maxGlobalActivity:]
	}
	h.actMu.Unlock()
	h.fanoutGlobal()
}

func (h *sseHub) snapshotGlobal() []activityItem {
	h.actMu.RLock()
	defer h.actMu.RUnlock()
	out := make([]activityItem, len(h.activity))
	copy(out, h.activity)
	return out
}

func (h *sseHub) fanoutGlobal() {
	items := h.snapshotGlobal()
	raw, _ := json.Marshal(items)
	payload := "event: activity\ndata: " + string(raw) + "\n\n"
	h.globMu.RLock()
	defer h.globMu.RUnlock()
	for _, ch := range h.globalSubs {
		select {
		case ch <- payload:
		default:
		}
	}
}

// ── Reclamation ──────────────────────────────────────────────────────────

// sweepLoop evicts idle live entries (the old map grew one entry per slug
// ever watched) plus their rings when nobody subscribes.
func (h *sseHub) sweepLoop() {
	ticker := time.NewTicker(sseSweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-h.done:
			return
		case <-ticker.C:
			h.sweep()
		}
	}
}

func (h *sseHub) sweep() {
	now := time.Now()
	var idle []string
	h.liveMu.RLock()
	for slug, e := range h.live {
		e.mu.RLock()
		last := e.lastEventAt
		if last.IsZero() {
			last = e.createdAt
		}
		stale := e.viewers == 0 && now.Sub(last) > liveEntryTTL
		e.mu.RUnlock()
		if stale {
			idle = append(idle, slug)
		}
	}
	h.liveMu.RUnlock()
	if len(idle) == 0 {
		return
	}
	h.liveMu.Lock()
	for _, slug := range idle {
		if e, ok := h.live[slug]; ok {
			e.mu.RLock()
			stillIdle := e.viewers == 0
			e.mu.RUnlock()
			if stillIdle {
				delete(h.live, slug)
			}
		}
	}
	h.liveMu.Unlock()

	h.mu.Lock()
	for _, slug := range idle {
		if len(h.subs[slug]) == 0 {
			delete(h.ring, slug)
			delete(h.seq, slug)
		}
	}
	h.mu.Unlock()
	log.Printf("[sse] swept %d idle slugs", len(idle))
}
