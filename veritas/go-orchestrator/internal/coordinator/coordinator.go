package coordinator

// Site coordinator: picks featured articles and queues the stalest refresh.
//
// Deterministic heuristics only (no LLM spend on a daily cron). Scoring blends
// freshness, views, claim depth, and recency; the stale leg reuses the same
// GetStaleArticles ranking as /stale. Writes go through the settings KV
// (featured_articles + coordinator_last_run audit) and the session engine via
// the queue callback, so backpressure/dedup refusals surface as reasons.

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

const (
	// Schedule fires daily at 05:00 UTC — after the last seed tick (00/06/12/18
	// cadence) so the coordinator scores the freshest corpus.
	Schedule = "0 5 * * *"
	// DailyLimit caps coordinator queue writes per UTC day (featured writes
	// are cheap settings KV updates and don't count; only refresh queues do).
	DailyLimit = 2
	// FeaturedCount matches the home page + mock bench width (3 picks).
	FeaturedCount = 3
	// staleThreshold mirrors the daily-refresh cutoff in api/server.go.
	staleThreshold = 0.4
)

// Store is the subset of *storage.DB the coordinator needs. *storage.DB
// satisfies it structurally; tests use fakes.
type Store interface {
	GetSettings() (map[string]string, error)
	SaveSettings(map[string]string) error
	ListArticles(limit, offset int) ([]*storage.Article, error)
	GetStaleArticles(limit int) ([]*storage.StaleArticle, error)
	GetArticleViewCount(slug string) (int, error)
	GetClaimsByArticle(slug string) ([]*storage.Claim, error)
}

// Result is the JSON shape for /coordinator/status and /coordinator/run.
type Result struct {
	At          string   `json:"at"`
	Featured    []string `json:"featured"`
	StaleQueued string   `json:"stale_queued"`
	Reason      string   `json:"reason"`
}

// Run performs one coordination pass. force bypasses the daily ceiling and
// the shared seed_paused kill-switch (explicit admin run-now always works;
// pause gates the cron, not the operator).
func Run(s Store, queue func(slug string) error, force bool) Result {
	now := time.Now().UTC()
	settings, err := s.GetSettings()
	if err != nil {
		return Result{At: now.Format(time.RFC3339), Reason: fmt.Sprintf("settings unreadable: %v", err)}
	}
	if settings["seed_paused"] == "1" && !force {
		return Result{At: now.Format(time.RFC3339), Reason: "paused (seed_paused=1)"}
	}
	today := now.Format("2006-01-02")
	count := 0
	if settings["coordinator_date"] == today {
		fmt.Sscanf(settings["coordinator_count"], "%d", &count)
	}
	if !force && count >= DailyLimit {
		return Result{At: now.Format(time.RFC3339), Reason: fmt.Sprintf("daily ceiling reached (%d/%d)", count, DailyLimit)}
	}

	featured := withPinned(s, settings, pickFeatured(s))
	staleSlug, staleReason := pickStale(s)

	queued := ""
	reason := staleReason
	if staleSlug != "" {
		if err := queue(staleSlug); err != nil {
			reason = fmt.Sprintf("queue refused for %s: %v", staleSlug, err)
		} else {
			queued = staleSlug
			count++
		}
	}

	if len(featured) > 0 {
		if b, err := json.Marshal(featured); err == nil {
			_ = s.SaveSettings(map[string]string{"featured_articles": string(b)})
		}
	}
	res := Result{At: now.Format(time.RFC3339), Featured: featured, StaleQueued: queued, Reason: reason}
	if b, err := json.Marshal(res); err == nil {
		_ = s.SaveSettings(map[string]string{
			"coordinator_last_run": string(b),
			"coordinator_date":     today,
			"coordinator_count":    fmt.Sprintf("%d", count),
		})
	}
	return res
}

// pickFeatured scores published articles and returns the top-N slugs.
// Any store error fails open with whatever scored (possibly empty) — the
// caller still gets a stale-queue attempt and an audit record.
func pickFeatured(s Store) []string {
	articles, err := s.ListArticles(200, 0)
	if err != nil {
		return nil
	}
	stale, _ := s.GetStaleArticles(200)
	fresh := make(map[string]float64, len(stale))
	for _, st := range stale {
		fresh[st.Slug] = st.FreshnessScore
	}
	type scored struct {
		slug      string
		score     float64
		updatedAt time.Time
	}
	var (
		list     []scored
		maxViews int
		maxClaim int
		views    = make(map[string]int)
		claims   = make(map[string]int)
	)
	for _, a := range articles {
		if a == nil || a.Slug == "" || a.Metadata.Status == "draft" {
			continue
		}
		v, _ := s.GetArticleViewCount(a.Slug)
		cs, _ := s.GetClaimsByArticle(a.Slug)
		views[a.Slug] = v
		claims[a.Slug] = len(cs)
		if v > maxViews {
			maxViews = v
		}
		if len(cs) > maxClaim {
			maxClaim = len(cs)
		}
	}
	now := time.Now().UTC()
	for _, a := range articles {
		if a == nil || a.Slug == "" || a.Metadata.Status == "draft" {
			continue
		}
		f := 0.5
		if v, ok := fresh[a.Slug]; ok {
			f = v
		}
		vn := 0.0
		if maxViews > 0 {
			vn = math.Log1p(float64(views[a.Slug])) / math.Log1p(float64(maxViews))
		}
		cn := 0.0
		if maxClaim > 0 {
			cn = float64(claims[a.Slug]) / float64(maxClaim)
		}
		updated := a.UpdatedAt
		if updated.IsZero() {
			updated = a.CreatedAt
		}
		days := now.Sub(updated).Hours() / 24
		if days < 0 {
			days = 0
		}
		recency := 1 / (1 + days/30)
		score := 0.4*f + 0.25*vn + 0.2*cn + 0.15*recency
		list = append(list, scored{slug: a.Slug, score: score, updatedAt: updated})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].score == list[j].score {
			return list[i].updatedAt.After(list[j].updatedAt)
		}
		return list[i].score > list[j].score
	})
	out := make([]string, 0, FeaturedCount)
	for i := 0; i < len(list) && i < FeaturedCount; i++ {
		out = append(out, list[i].slug)
	}
	return out
}

// withPinned keeps admin-pinned slugs first and tops up with scored picks
// to FeaturedCount. Manual picks survive the nightly run; pinned slugs that
// no longer resolve to a published article drop out silently.
func withPinned(s Store, settings map[string]string, scored []string) []string {
	var pinned []string
	if raw := settings["featured_pinned"]; raw != "" {
		_ = json.Unmarshal([]byte(raw), &pinned)
	}
	published := make(map[string]bool)
	if articles, err := s.ListArticles(200, 0); err == nil {
		for _, a := range articles {
			if a != nil && a.Slug != "" && a.Metadata.Status != "draft" {
				published[a.Slug] = true
			}
		}
	}
	out := make([]string, 0, FeaturedCount)
	seen := make(map[string]bool)
	for _, slug := range pinned {
		if len(out) >= FeaturedCount || seen[slug] || !published[slug] {
			continue
		}
		seen[slug] = true
		out = append(out, slug)
	}
	for _, slug := range scored {
		if len(out) >= FeaturedCount || seen[slug] {
			continue
		}
		seen[slug] = true
		out = append(out, slug)
	}
	return out
}

// pickStale returns the single stalest slug when it is actually stale.
func pickStale(s Store) (string, string) {
	stale, err := s.GetStaleArticles(1)
	if err != nil {
		return "", fmt.Sprintf("stale lookup failed: %v", err)
	}
	if len(stale) == 0 {
		return "", "nothing tracked"
	}
	if stale[0].FreshnessScore >= staleThreshold {
		return "", fmt.Sprintf("freshest stale %s still fresh (%.2f)", stale[0].Slug, stale[0].FreshnessScore)
	}
	return stale[0].Slug, ""
}

// NextTick returns the next 05:00 UTC fire time for Schedule.
func NextTick(now time.Time) time.Time {
	now = now.UTC()
	t := time.Date(now.Year(), now.Month(), now.Day(), 5, 0, 0, 0, time.UTC)
	if t.After(now) {
		return t
	}
	return t.Add(24 * time.Hour)
}
