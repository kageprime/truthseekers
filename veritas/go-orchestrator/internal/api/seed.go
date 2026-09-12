package api

import (
	"log"
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
// daily ceiling.
func (s *Server) runSeedTrickle() {
	settings, err := s.db.GetSettings()
	if err != nil {
		log.Printf("[seed] settings unreadable, skipping tick: %v", err)
		return
	}
	today := time.Now().UTC().Format("2006-01-02")
	count := 0
	if settings["seed_trickle_date"] == today {
		count, _ = strconv.Atoi(settings["seed_trickle_count"])
	}
	if count >= seedDailyLimit {
		log.Printf("[seed] daily ceiling reached (%d/%d), idling", count, seedDailyLimit)
		return
	}
	for _, slug := range defaultSeedBench {
		a, err := s.db.GetArticle(slug)
		if err != nil {
			log.Printf("[seed] article lookup failed, skipping tick: %v", err)
			return
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
			log.Printf("[seed] session refused for %s, retrying next tick: %v", slug, err)
			return
		}
		log.Printf("[seed] queued %s (%d/%d today)", slug, count+1, seedDailyLimit)
		if err := s.db.SaveSettings(map[string]string{
			"seed_trickle_date":  today,
			"seed_trickle_count": strconv.Itoa(count + 1),
		}); err != nil {
			log.Printf("[seed] queued %s but counter save failed: %v", slug, err)
		}
		return
	}
	// Bench exhausted.
	if os.Getenv("SEED_AUTO_GAPS") == "1" {
		s.runSeedGap()
		return
	}
	log.Printf("[seed] bench exhausted (%d topics live); set SEED_AUTO_GAPS=1 for gap-driven phase two", len(defaultSeedBench))
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
