package api

import (
	"testing"
	"time"
)

// ponytail: the SSE-resume fix — reconnects replay the middle via Last-Event-ID
// instead of heartbeat-only, and anonymous replays stay completion-only.
func TestSSEResume(t *testing.T) {
	h := newSSEHub()
	defer h.Stop()

	h.broadcast("slug-a", "progress", map[string]interface{}{"phase": "research"})
	h.broadcast("slug-a", "progress", map[string]interface{}{"phase": "write"})
	h.broadcast("slug-a", "article_complete", map[string]interface{}{"title": "Done"})

	frames := h.replaySince("slug-a", 1, true)
	if len(frames) != 2 {
		t.Fatalf("replay after id=1: got %d frames, want 2", len(frames))
	}
	if got := sseEventName(frames[0]); got != "progress" {
		t.Fatalf("first replayed event=%q, want progress", got)
	}
	if got := sseEventName(frames[1]); got != "article_complete" {
		t.Fatalf("second replayed event=%q, want article_complete", got)
	}

	anon := h.replaySince("slug-a", 0, false)
	if len(anon) != 1 || sseEventName(anon[0]) != "article_complete" {
		t.Fatalf("anon replay leaked progress: %d frames", len(anon))
	}

	if got := h.replaySince("slug-a", 99, true); len(got) != 0 {
		t.Fatalf("replay past tip: got %d frames, want 0", len(got))
	}
}

func TestSSESweepReclaimsIdle(t *testing.T) {
	h := newSSEHub()
	defer h.Stop()

	h.broadcast("idle-slug", "progress", map[string]interface{}{"phase": "research"})
	e := h.getOrCreateLive("idle-slug")
	e.mu.Lock()
	e.lastEventAt = time.Now().Add(-time.Hour)
	e.mu.Unlock()

	h.sweep()

	h.liveMu.RLock()
	_, ok := h.live["idle-slug"]
	h.liveMu.RUnlock()
	if ok {
		t.Fatal("idle live entry survived sweep")
	}
	h.mu.RLock()
	_, ringOK := h.ring["idle-slug"]
	h.mu.RUnlock()
	if ringOK {
		t.Fatal("idle ring survived sweep")
	}
}
