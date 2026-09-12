package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
)

// Seed trickle: background article generation through the curated bench.
//
// One programmatic cron trigger (no veritas.json dependency, so it deploys
// identically locally and on Heroku) fires four times daily; each tick
// queues the first bench slug with no live article. Existence-keyed
// selection makes it idempotent across restarts — no pointer to persist.
// A date-stamped counter in the settings KV enforces the daily ceiling and
// survives dyno restarts; any settings/DB error fails CLOSED (no blind
// queueing against an unreadable budget).
const (
	// seedTrickleCron fires at 00:00, 06:00, 12:00 and 18:00 UTC — 4/day.
	seedTrickleCron = "0 */6 * * *"
	// seedDailyLimit caps queued generations per UTC day.
	seedDailyLimit = 4
)

// defaultSeedBench is the curated opening bench in priority order. Slugs
// already live in the DB are skipped; when every slug exists the tick
// either idles or (SEED_AUTO_GAPS=1) falls through to gap-driven phase two.
var defaultSeedBench = []string{
	// Physical world / overview science.
	"photosynthesis",
	"plate-tectonics",
	"human-genome-project",
	"black-holes",
	"vaccines-and-the-immune-response",
	// Places and movement.
	"silk-road",
	"panama-canal",
	"timbuktu",
	"polynesian-navigation",
	// People and power.
	"marie-curie",
	"alan-turing",
	"haile-selassie",
	"manhattan-project",
	// Culture and craft.
	"printing-press",
	"origins-of-jazz",
	"bauhaus",
	"oral-epic-traditions",
	"roman-empire",
	"fall-of-constantinople",
	"great-barrier-reef",
}

// runSeedTrickle queues at most one bench article per tick, honoring the
// pause flag and the daily ceiling.
func (s *Server) runSeedTrickle() {
	if paused, _ := s.seedPaused(); paused {
		log.Printf("[seed] paused, skipping tick")
		return
	}
	slug, reason := s.runSeedOnce(false)
	if slug != "" {
		log.Printf("[seed] queued %s", slug)
	} else {
		log.Printf("[seed] idle: %s", reason)
	}
}

// runSeedOnce performs a single trickle step. force bypasses the daily
// ceiling (manual run-now); the pause flag is checked by the cron caller,
// not here, so an explicit run always works. Returns the queued slug or a
// human-readable idle reason.
func (s *Server) runSeedOnce(force bool) (slug string, reason string) {
	settings, err := s.db.GetSettings()
	if err != nil {
		return "", fmt.Sprintf("settings unreadable: %v", err)
	}
	today := time.Now().UTC().Format("2006-01-02")
	count := 0
	if settings["seed_trickle_date"] == today {
		count, _ = strconv.Atoi(settings["seed_trickle_count"])
	}
	if !force && count >= seedDailyLimit {
		return "", fmt.Sprintf("daily ceiling reached (%d/%d)", count, seedDailyLimit)
	}
	for _, slug := range defaultSeedBench {
		a, err := s.db.GetArticle(slug)
		if err != nil {
			return "", fmt.Sprintf("article lookup failed: %v", err)
		}
		if a != nil {
			continue
		}
		if _, err := s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
			Slug:    slug,
			Persona: "veritas",
			Source:  "trigger:seed",
		}); err != nil {
			// Backpressure, dedup or idempotency refusal — retry next tick.
			return "", fmt.Sprintf("session refused for %s: %v", slug, err)
		}
		if err := s.db.SaveSettings(map[string]string{
			"seed_trickle_date":  today,
			"seed_trickle_count": strconv.Itoa(count + 1),
		}); err != nil {
			log.Printf("[seed] queued %s but counter save failed: %v", slug, err)
		}
		return slug, ""
	}
	// Bench exhausted.
	if os.Getenv("SEED_AUTO_GAPS") == "1" {
		s.runSeedGap()
		return "", "bench exhausted, gap phase attempted"
	}
	return "", fmt.Sprintf("bench exhausted (%d topics live); set SEED_AUTO_GAPS=1 for gap-driven phase two", len(defaultSeedBench))
}

// runSeedGap is phase two: with the bench exhausted, regenerate the single
// stalest article instead of idling. Gated behind SEED_AUTO_GAPS=1.
func (s *Server) runSeedGap() {
	stale, err := s.db.GetStaleArticles(1)
	if err != nil || len(stale) == 0 {
		log.Printf("[seed] gap phase: nothing stale to refresh (err=%v)", err)
		return
	}
	slug := stale[0].Slug
	if _, err := s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
		Slug:    slug,
		Persona: "veritas",
		Source:  "trigger:seed-gap",
	}); err != nil {
		log.Printf("[seed] gap session refused for %s: %v", slug, err)
		return
	}
	log.Printf("[seed] gap phase queued stalest article: %s", slug)
}

func writeSeedJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	b, _ := json.Marshal(v)
	w.Write(b)
}

// seedPaused reports the admin kill-switch (settings KV, survives restarts).
func (s *Server) seedPaused() (bool, error) {
	settings, err := s.db.GetSettings()
	if err != nil {
		return false, err
	}
	return settings["seed_paused"] == "1", nil
}

// seedCountToday reads the date-stamped daily counter.
func (s *Server) seedCountToday() (date string, count int) {
	date = time.Now().UTC().Format("2006-01-02")
	settings, err := s.db.GetSettings()
	if err != nil {
		return date, 0
	}
	if settings["seed_trickle_date"] == date {
		count, _ = strconv.Atoi(settings["seed_trickle_count"])
	}
	return date, count
}

// nextSeedTick returns the next 00/06/12/18 UTC fire time for seedTrickleCron.
func nextSeedTick(now time.Time) time.Time {
	now = now.UTC()
	for _, h := range []int{0, 6, 12, 18} {
		t := time.Date(now.Year(), now.Month(), now.Day(), h, 0, 0, 0, time.UTC)
		if t.After(now) {
			return t
		}
	}
	return time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
}

// handleSeedStatus reports trickle state for the admin panel: pause flag,
// today’s budget, bench progress (existence-keyed, same as the tick), and
// the next scheduled fire.
func (s *Server) handleSeedStatus(w http.ResponseWriter, r *http.Request) {
	paused, _ := s.seedPaused()
	date, count := s.seedCountToday()
	live := make([]string, 0)
	pending := make([]string, 0)
	for _, slug := range defaultSeedBench {
		if a, err := s.db.GetArticle(slug); err == nil && a != nil {
			live = append(live, slug)
		} else {
			pending = append(pending, slug)
		}
	}
	writeSeedJSON(w, map[string]interface{}{
		"paused":    paused,
		"schedule":  seedTrickleCron,
		"next_tick": nextSeedTick(time.Now()).UTC().Format(time.RFC3339),
		"today":     map[string]interface{}{"date": date, "count": count, "limit": seedDailyLimit},
		"bench":     map[string]interface{}{"total": len(defaultSeedBench), "live": live, "pending": pending},
		"auto_gaps": os.Getenv("SEED_AUTO_GAPS") == "1",
	})
}

// handleSeedRun queues the next bench slug immediately. Honors the ceiling
// unless ?force=1 (explicit admin override); ignores the pause flag.
func (s *Server) handleSeedRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"use POST"}`, http.StatusMethodNotAllowed)
		return
	}
	force := r.URL.Query().Get("force") == "1"
	slug, reason := s.runSeedOnce(force)
	if slug == "" {
		w.WriteHeader(http.StatusConflict)
		writeSeedJSON(w, map[string]string{"queued": "", "reason": reason})
		return
	}
	reqLog(r, "seed-run slug=%s force=%t", slug, force)
	writeSeedJSON(w, map[string]string{"queued": slug, "reason": reason})
}

// handleSeedPause flips the admin kill-switch stopping cron ticks (manual
// run-now still works). POST with {"paused":true|false}.
func (s *Server) handleSeedPause(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"use POST"}`, http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Paused *bool `json:"paused"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Paused == nil {
		http.Error(w, `{"error":"body must be {\"paused\":bool}"}`, http.StatusBadRequest)
		return
	}
	val := "0"
	if *body.Paused {
		val = "1"
	}
	if err := s.db.SaveSettings(map[string]string{"seed_paused": val}); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}
	reqLog(r, "seed-pause paused=%t", *body.Paused)
	writeSeedJSON(w, map[string]bool{"paused": *body.Paused})
}