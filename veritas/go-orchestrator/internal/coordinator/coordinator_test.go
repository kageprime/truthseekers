package coordinator

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

type fakeStore struct {
	settings map[string]string
	articles []*storage.Article
	stale    []*storage.StaleArticle
	views    map[string]int
	claims   map[string][]*storage.Claim
	saved    map[string]string
}

func (f *fakeStore) GetSettings() (map[string]string, error) {
	out := map[string]string{}
	for k, v := range f.settings {
		out[k] = v
	}
	return out, nil
}

func (f *fakeStore) SaveSettings(m map[string]string) error {
	for k, v := range m {
		f.saved[k] = v
		f.settings[k] = v
	}
	return nil
}

func (f *fakeStore) ListArticles(limit, offset int) ([]*storage.Article, error) {
	return f.articles, nil
}

func (f *fakeStore) GetStaleArticles(limit int) ([]*storage.StaleArticle, error) {
	if limit > 0 && limit < len(f.stale) {
		return f.stale[:limit], nil
	}
	return f.stale, nil
}

func (f *fakeStore) GetArticleViewCount(slug string) (int, error) { return f.views[slug], nil }

func (f *fakeStore) Claims(slug string) []*storage.Claim { return f.claims[slug] }

func (f *fakeStore) GetClaimsByArticle(slug string) ([]*storage.Claim, error) {
	return f.claims[slug], nil
}

func mkArticle(slug, status string, updated time.Time) *storage.Article {
	return &storage.Article{Slug: slug, Title: slug, Metadata: storage.ArticleMetadata{Status: status}, UpdatedAt: updated}
}

func TestRunPicksFeaturedAndQueuesStale(t *testing.T) {
	now := time.Now().UTC()
	fs := &fakeStore{
		settings: map[string]string{},
		articles: []*storage.Article{
			mkArticle("fresh-hit", "published", now.Add(-24*time.Hour)),
			mkArticle("old-niche", "published", now.Add(-300*24*time.Hour)),
			mkArticle("draft-skip", "draft", now),
		},
		stale: []*storage.StaleArticle{
			{Slug: "old-niche", FreshnessScore: 0.1, ClaimCount: 4},
			{Slug: "fresh-hit", FreshnessScore: 0.9, ClaimCount: 9},
		},
		views: map[string]int{"fresh-hit": 100, "old-niche": 2},
		claims: map[string][]*storage.Claim{
			"fresh-hit": {{ID: "1"}, {ID: "2"}, {ID: "3"}},
			"old-niche": {{ID: "9"}},
		},
		saved: map[string]string{},
	}
	var queued []string
	res := Run(fs, func(slug string) error { queued = append(queued, slug); return nil }, false)
	if len(queued) != 1 || queued[0] != "old-niche" {
		t.Fatalf("expected old-niche queued, got %v (reason=%s)", queued, res.Reason)
	}
	if len(res.Featured) != 2 {
		t.Fatalf("expected 2 featured (draft skipped), got %v", res.Featured)
	}
	for _, s := range res.Featured {
		if s == "draft-skip" {
			t.Fatalf("draft must never be featured: %v", res.Featured)
		}
	}
	if res.Featured[0] != "fresh-hit" {
		t.Fatalf("fresh-hit should rank first, got %v", res.Featured)
	}
	var feat []string
	if err := json.Unmarshal([]byte(fs.saved["featured_articles"]), &feat); err != nil || len(feat) != 2 {
		t.Fatalf("featured_articles not persisted: %v err=%v", fs.saved["featured_articles"], err)
	}
	if fs.saved["coordinator_last_run"] == "" {
		t.Fatal("missing coordinator_last_run audit")
	}
}

func TestRunRespectsPauseAndCeiling(t *testing.T) {
	mk := func(settings map[string]string) *fakeStore {
		return &fakeStore{settings: settings, saved: map[string]string{}, views: map[string]int{}, claims: map[string][]*storage.Claim{}}
	}
	calls := 0
	q := func(slug string) error { calls++; return nil }

	if res := Run(mk(map[string]string{"seed_paused": "1"}), q, false); res.Reason == "" || calls != 0 {
		t.Fatalf("paused run must skip queueing: %+v calls=%d", res, calls)
	}
	today := time.Now().UTC().Format("2006-01-02")
	res := Run(mk(map[string]string{"coordinator_date": today, "coordinator_count": "2"}), q, false)
	if calls != 0 || res.Reason == "" {
		t.Fatalf("ceiling run must skip queueing: %+v calls=%d", res, calls)
	}
	res = Run(mk(map[string]string{"coordinator_date": today, "coordinator_count": "2"}), q, true)
	_ = res // force bypasses ceiling; stale empty so nothing queued but no ceiling reason
	if res.Reason == "daily ceiling reached (2/2)" {
		t.Fatal("force must bypass the ceiling")
	}
}

func TestQueueRefusalSurfacesReason(t *testing.T) {
	fs := &fakeStore{
		settings: map[string]string{},
		stale:    []*storage.StaleArticle{{Slug: "crusty", FreshnessScore: 0.05}},
		saved:    map[string]string{}, views: map[string]int{}, claims: map[string][]*storage.Claim{},
	}
	res := Run(fs, func(slug string) error { return errors.New("backpressure") }, false)
	if res.StaleQueued != "" || res.Reason == "" {
		t.Fatalf("refusal must surface reason, got %+v", res)
	}
}
