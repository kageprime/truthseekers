package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/dag"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// Article generation pipeline.
//
// processArticle runs the 9-node epistemic DAG (retrieve → extract_claims →
// … → generate_article) using native Go LLM calls, broadcasts per-node
// progress over SSE, then transforms the generate_article node's
// `{article: {...}}` output into a storage.Article and persists it.

// articleSystemPrompt is the system prompt used by the article generation DAG.
// It's the preamble + deep epistemic framework (no chat tool rules or tone
// modifiers).
var articleSystemPrompt string

func init() {
	articleSystemPrompt = veritasPreamble + "\n\n" + loadSharedSystemPrompt()
}

// buildArticleWorkflow constructs the canonical 9-node epistemic pipeline
// using Go LLM-based executors.  Dependency graph mirrors the original Python
// pipeline.
func buildArticleWorkflow() *dag.Workflow {
	execs := agent.DAGNodeExecutors(articleSystemPrompt)
	return &dag.Workflow{
		Nodes: []dag.Node{
			{ID: "retrieve", DependsOn: []string{}, Execute: execs["retrieve"]},
			{ID: "extract_claims", DependsOn: []string{"retrieve"}, Execute: execs["extract_claims"]},
			{ID: "map_evidence", DependsOn: []string{"retrieve", "extract_claims"}, Execute: execs["map_evidence"]},
			{ID: "critique", DependsOn: []string{"retrieve", "extract_claims", "map_evidence"}, Execute: execs["critique"]},
			{ID: "detect_missing", DependsOn: []string{"extract_claims", "map_evidence"}, Execute: execs["detect_missing"]},
			{ID: "map_language", DependsOn: []string{"extract_claims"}, Execute: execs["map_language"]},
			{ID: "scrutinize", DependsOn: []string{"extract_claims", "critique", "detect_missing", "map_language"}, Execute: execs["scrutinize"]},
			{ID: "resolve", DependsOn: []string{"extract_claims", "map_evidence", "critique", "scrutinize"}, Execute: execs["resolve"]},
			{ID: "generate_article", DependsOn: []string{"resolve"}, Execute: execs["generate_article"]},
		},
	}
}

// humanPhase maps each DAG node to a frontend-facing phase name. The frontend's
// ProcessViewer / GenerationBar reads the `phase` field on SSE progress events.
var humanPhase = map[string]string{
	"retrieve":         "research",
	"extract_claims":   "research",
	"map_evidence":     "research",
	"critique":         "outline",
	"detect_missing":   "outline",
	"map_language":     "outline",
	"scrutinize":       "verify",
	"resolve":          "verify",
	"generate_article": "write",
}

// processArticle executes the full generation pipeline for a slug and persists
// the result.
func (s *Server) processArticle(slug string, persona string) {
	start := time.Now()
	log.Printf("🖌️ [generate] starting pipeline slug=%s persona=%s", slug, persona)

	queryJSON, _ := json.Marshal(map[string]string{"topic": slug})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	workflow := buildArticleWorkflow()
	updates, err := workflow.Execute(ctx, string(queryJSON))
	if err != nil {
		s.failArticle(slug, fmt.Sprintf("workflow invalid: %v", err))
		return
	}

	// Track the generate_article node output; it's the source of the final Article.
	var generatedOutput interface{}
	var pipelineFailed bool

	for update := range updates {
		switch update.Status {
		case "running":
			phase := humanPhase[update.NodeID]
			if phase == "" {
				phase = update.NodeID
			}
			_ = s.db.SaveJob(slug, "writing", phase, map[string]interface{}{"title": slug, "persona": persona, "node": update.NodeID})
			BroadcastProgress(slug, "progress", map[string]interface{}{
				"slug":      slug,
				"phase":     phase,
				"node":      update.NodeID,
				"status":    "running",
				"timestamp": time.Now().Unix(),
			})
		case "failed":
			pipelineFailed = true
			log.Printf("💥 [generate] node %s failed: %s", update.NodeID, update.Error)
			BroadcastProgress(slug, "progress", map[string]interface{}{
				"slug":      slug,
				"node":      update.NodeID,
				"status":    "failed",
				"error":     update.Error,
				"timestamp": time.Now().Unix(),
			})
		case "completed":
			if update.NodeID == "generate_article" {
				generatedOutput = update.Output
			}
			log.Printf("✓ [generate] node %s completed", update.NodeID)
		}
	}

	if pipelineFailed || ctx.Err() != nil {
		reason := "a pipeline node failed"
		if ctx.Err() != nil {
			reason = "generation timed out"
		}
		s.failArticle(slug, reason)
		return
	}

	art := transformGeneratedArticle(slug, generatedOutput)
	if err := s.db.SaveArticle(art); err != nil {
		s.failArticle(slug, fmt.Sprintf("save article: %v", err))
		return
	}
	_ = s.db.SaveJob(slug, "done", "store", map[string]interface{}{"title": art.Title})

	BroadcastProgress(slug, "article_complete", map[string]interface{}{
		"slug":               slug,
		"article_id":         slug,
		"title":              art.Title,
		"derived_confidence": art.DerivedConfidence,
		"timestamp":          time.Now().Unix(),
	})
	log.Printf("✓ [generate] complete slug=%s title=%q in %s", slug, art.Title, time.Since(start).Round(time.Millisecond))
}

// failArticle marks the job as errored and notifies subscribers.
func (s *Server) failArticle(slug string, reason string) {
	_ = s.db.SaveJob(slug, "error", "error", map[string]interface{}{"title": slug, "error": reason})
	BroadcastProgress(slug, "progress", map[string]interface{}{
		"slug":      slug,
		"phase":     "error",
		"status":    "failed",
		"error":     reason,
		"timestamp": time.Now().Unix(),
	})
	log.Printf("💥 [generate] failed slug=%s: %s", slug, reason)
}

// articlePayload mirrors the generate_article node output:
// `{article: {title, abstract, sections[], timeline[], categories[], crossrefs[], citations[]}}`.
type articlePayload struct {
	Article struct {
		Title       string                 `json:"title"`
		Abstract    string                 `json:"abstract"`
		Summary     string                 `json:"summary"` // legacy/mock field; used iff Abstract is empty
		Sections    []storage.Section      `json:"sections"`
		Timeline    []storage.TimelineEvent `json:"timeline"`
		Categories  []string               `json:"categories"`
		Crossrefs   []storage.CrossReference `json:"crossrefs"`
		Citations   []storage.Citation     `json:"citations"`
		Confidence  map[string]interface{} `json:"confidence_vector,omitempty"`
		Derived     float64                `json:"derived_confidence,omitempty"`
	} `json:"article"`
}

// transformGeneratedArticle converts the raw generate_article node output
// (interface{} from the DAG channel) into a storage.Article ready to persist.
// Falls back to a stub-shaped article when the output is missing or malformed
// so the frontend always gets a renderable article.
func transformGeneratedArticle(slug string, raw interface{}) *storage.Article {
	// Re-marshal through JSON so map[string]interface{} and typed structs both
	// decode cleanly into articlePayload regardless of which path produced it.
	rawBytes, err := json.Marshal(raw)
	if err != nil || len(rawBytes) == 0 {
		log.Printf("⚠️ [generate] empty/malformed article output for slug=%s, using stub", slug)
		return stubArticle(slug)
	}

	var payload articlePayload
	if err := json.Unmarshal(rawBytes, &payload); err != nil || payload.Article.Title == "" {
		log.Printf("⚠️ [generate] could not parse article output for slug=%s (err=%v), using stub", slug, err)
		return stubArticle(slug)
	}

	abstract := payload.Article.Abstract
	if abstract == "" {
		abstract = payload.Article.Summary
	}

	sections := payload.Article.Sections
	if len(sections) == 0 && abstract != "" {
		sections = []storage.Section{{
			ID:      "overview",
			Title:   "Overview",
			Content: abstract,
		}}
	}

	derived := payload.Article.Derived
	if derived == 0 {
		derived = 0.85 // sensible default when the node omits a score
	}

	return &storage.Article{
		Slug:              slug,
		Title:             payload.Article.Title,
		Abstract:          abstract,
		Sections:          sections,
		Timeline:          payload.Article.Timeline,
		Categories:        payload.Article.Categories,
		Crossrefs:         payload.Article.Crossrefs,
		Citations:         payload.Article.Citations,
		ConfidenceVector:  payload.Article.Confidence,
		DerivedConfidence: derived,
		Metadata: storage.ArticleMetadata{
			Version:     1,
			Status:      "published",
			Created:     time.Now().UTC().Format(time.RFC3339),
			Updated:     time.Now().UTC().Format(time.RFC3339),
			GeneratedBy: "veritas-pipeline",
		},
	}
}

// stubArticle returns a minimal renderable article, used only when the
// generate_article node produced no usable output.
func stubArticle(slug string) *storage.Article {
	return &storage.Article{
		Slug:     slug,
		Title:    slug,
		Abstract: fmt.Sprintf("An article on %s could not be fully generated.", slug),
		Blocks: []interface{}{
			map[string]interface{}{"id": "h1", "type": "heading", "data": map[string]interface{}{"level": 1, "text": slug}},
			map[string]interface{}{"id": "p1", "type": "text", "data": map[string]interface{}{"text": fmt.Sprintf("Generation of this article (%s) did not produce content.", slug)}},
		},
		DerivedConfidence: 0.0,
		Metadata: storage.ArticleMetadata{
			Version:     1,
			Status:      "published",
			GeneratedBy: "veritas-stub-fallback",
		},
	}
}
