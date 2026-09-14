package api

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/dag"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

func testGenerateServer(t *testing.T) *Server {
	t.Helper()
	t.Setenv("ALLOW_DEV_AUTH", "1")
	db, err := storage.NewDB("", t.TempDir())
	if err != nil {
		t.Fatalf("mock db: %v", err)
	}
	return NewServer("4097", db)
}

// fakeWorkflow runs the real 9-node shape with instant canned outputs —
// no LLM keys, no network. Resolve stays supported/high-confidence so the
// verify sampler stays silent; prose stays clean so the writer never retries.
func fakeWorkflow(article interface{}) func(string) *dag.Workflow {
	canned := map[string]interface{}{
		"retrieve":        map[string]interface{}{"documents": map[string]interface{}{"web": []interface{}{map[string]interface{}{"id": "doc-1", "title": "Test Source", "url": "https://example.com/test"}}}},
		"extract_claims":  map[string]interface{}{"claims": []interface{}{map[string]interface{}{"claim_id": "c1", "text": "Reliability testing catches regressions before users do.", "type": "factual", "status": "supported"}}},
		"map_evidence":    map[string]interface{}{"mappings": []interface{}{}},
		"critique":        map[string]interface{}{},
		"detect_missing":  map[string]interface{}{"gaps": []interface{}{}},
		"map_language":    map[string]interface{}{"language_flags": []interface{}{}},
		"scrutinize":      map[string]interface{}{"risk_assessments": []interface{}{}},
		"resolve":         map[string]interface{}{"resolved_claims": []interface{}{map[string]interface{}{"claim_id": "c1", "text": "Reliability testing catches regressions before users do.", "status": "supported", "derived_confidence": 0.9, "evidence_ids": []interface{}{}}}},
		"generate_article": article,
	}
	deps := map[string][]string{
		"retrieve": {}, "extract_claims": {"retrieve"},
		"map_evidence": {"retrieve", "extract_claims"},
		"critique":     {"retrieve", "extract_claims", "map_evidence"},
		"detect_missing": {"extract_claims", "map_evidence"},
		"map_language":   {"extract_claims"},
		"scrutinize":     {"extract_claims", "critique", "detect_missing", "map_language"},
		"resolve":        {"extract_claims", "map_evidence", "critique", "scrutinize"},
		"generate_article": {"resolve", "retrieve", "extract_claims"},
	}
	return func(string) *dag.Workflow {
		w := &dag.Workflow{}
		for id, out := range canned {
			out := out
			w.Nodes = append(w.Nodes, dag.Node{
				ID: id, DependsOn: deps[id], Retry: nodeRetry, Timeout: time.Minute,
				Execute: func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
					return out, nil
				},
			})
		}
		return w
	}
}

func goodArticle() map[string]interface{} {
	return map[string]interface{}{"article": map[string]interface{}{
		"title":    "Test Reliability",
		"abstract": "A short abstract describing reliability testing practices.",
		"sections": []interface{}{map[string]interface{}{
			"id": "overview", "title": "Overview",
			"content": "Reliability testing exercises failure paths under controlled conditions. Teams record outcomes and compare them across releases to track progress.",
		}},
		"categories": []interface{}{"test"},
		"crossrefs":  []interface{}{},
		"citations":  []interface{}{map[string]interface{}{"title": "Test Source", "url": "https://example.com/test"}},
		"confidence_vector":    map[string]interface{}{"coverage": 0.9},
		"derived_confidence":   0.9,
	}}
}

// Happy path runs end to end without LLM keys.
func TestProcessArticleFakeWorkflow(t *testing.T) {
	s := testGenerateServer(t)
	s.workflowBuilder = fakeWorkflow(goodArticle())
	if err := s.processArticle("ci-fake-success", "veritas", ""); err != nil {
		t.Fatalf("processArticle: %v", err)
	}
}

// Malformed writer output must fail loudly — never publish a stub as "published".
func TestProcessArticleBadOutputFails(t *testing.T) {
	s := testGenerateServer(t)
	s.workflowBuilder = fakeWorkflow(map[string]interface{}{})
	if err := s.processArticle("ci-fake-bad", "veritas", ""); err == nil {
		t.Fatal("expected error for malformed writer output, got nil")
	}
}

// Full persistence against real Postgres. Runs in CI (service container);
// skipped locally unless TEST_DATABASE_URL is set.
func TestProcessArticlePersistsPostgres(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL unset")
	}
	t.Setenv("ALLOW_DEV_AUTH", "1")
	db, err := storage.NewDB(url, "")
	if err != nil {
		t.Fatalf("pg connect: %v", err)
	}
	defer db.Close()
	if err := db.Migrate("../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	s := NewServer("4097", db)
	s.workflowBuilder = fakeWorkflow(goodArticle())
	slug := fmt.Sprintf("ci-persist-%d", time.Now().UnixNano())
	if err := s.processArticle(slug, "veritas", ""); err != nil {
		t.Fatalf("processArticle: %v", err)
	}
	got, err := db.GetArticle(slug)
	if err != nil || got == nil {
		t.Fatalf("get article: %v %+v", err, got)
	}
	if got.Title != "Test Reliability" {
		t.Fatalf("title=%q, want %q", got.Title, "Test Reliability")
	}
}
