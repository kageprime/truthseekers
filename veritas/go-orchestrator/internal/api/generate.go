package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
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
// pipeline. A non-empty contestNote arms resolve + generate_article with the
// reader's challenge (see DAGNodeExecutorsWithContext); empty behaves flat.
// nodeRetry is the shared resilience budget: transient LLM flakes (429/5xx,
// mid-stream drops) retry with backoff instead of killing the 15m job.
// ponytail: one policy for all nodes — per-node tuning when data says so.
var nodeRetry = dag.RetryPolicy{MaxAttempts: 3, BackoffBase: time.Second, BackoffMax: 8 * time.Second}

func buildArticleWorkflow(contestNote string) *dag.Workflow {
	execs := agent.DAGNodeExecutorsWithContext(articleSystemPrompt, contestNote)
	n := func(id string, timeout time.Duration, deps ...string) dag.Node {
		return dag.Node{ID: id, DependsOn: deps, Execute: execs[id], Retry: nodeRetry, Timeout: timeout}
	}
	return &dag.Workflow{
		Nodes: []dag.Node{
			n("retrieve", 2*time.Minute),
			n("extract_claims", 2*time.Minute, "retrieve"),
			n("map_evidence", 90*time.Second, "retrieve", "extract_claims"),
			n("critique", 90*time.Second, "retrieve", "extract_claims", "map_evidence"),
			n("detect_missing", 90*time.Second, "extract_claims", "map_evidence"),
			n("map_language", 90*time.Second, "extract_claims"),
			n("scrutinize", 2*time.Minute, "extract_claims", "critique", "detect_missing", "map_language"),
			n("resolve", 2*time.Minute, "extract_claims", "map_evidence", "critique", "scrutinize"),
			n("generate_article", 5*time.Minute, "resolve", "retrieve", "extract_claims"),
			n("generate_media", 2*time.Minute, "resolve", "retrieve"),
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
	"generate_media":   "media",
}

// processArticle executes the full generation pipeline for a slug and persists
// the result. A non-empty note (e.g. an upheld contestation) travels into
// retrieval as query context and into resolve/generate as a hypothesis.
// The returned error drives session retry: failArticle records the job/SSE
// state, the error moves the session to failed (→ requeue until maxRetries).
func (s *Server) processArticle(slug string, persona string, note string) error {
	start := time.Now()
	log.Printf("🖌️ [generate] starting pipeline slug=%s persona=%s contest=%t", slug, persona, note != "")

	query := map[string]string{"topic": slug}
	if note != "" {
		query["contestation"] = note
	}
	queryJSON, _ := json.Marshal(query)
	// ponytail: 9 nodes, 7-deep sequential chain, each LLM call budgeted up
	// to 120s — 5m starved generate_article (the heaviest node) with ~30s
	// left after 8 nodes on a slow reasoning model. 15m fits the worst case
	// with headroom; the client SSE survives via progress heartbeats.
	// Parent is the server run ctx so Shutdown cancels LLM spend on SIGTERM.
	ctx, cancel := context.WithTimeout(s.runCtx, 15*time.Minute)
	defer cancel()

	builder := s.workflowBuilder
	if builder == nil {
		builder = buildArticleWorkflow
	}
	workflow := builder(note)
	updates, err := workflow.Execute(ctx, string(queryJSON))
	if err != nil {
		reason := fmt.Sprintf("workflow invalid: %v", err)
		s.failArticle(slug, reason)
		return fmt.Errorf("%s", reason)
	}

	// Collect node outputs for epistemic persistence.
	var generatedOutput interface{}
	nodeOutputs := make(map[string]interface{})
	var pipelineFailed bool

	for update := range updates {
		switch update.Status {
		case "running":
			phase := humanPhase[update.NodeID]
			if phase == "" {
				phase = update.NodeID
			}
			_ = s.db.SaveJob(slug, "writing", phase, map[string]interface{}{"title": slug, "persona": persona})
			s.sse.broadcast(slug, "progress", map[string]interface{}{
				"slug":      slug,
				"phase":     phase,
				"status":    "running",
				"timestamp": time.Now().Unix(),
			})
		case "failed":
			pipelineFailed = true
			log.Printf("💥 [generate] node %s failed: %s", update.NodeID, update.Error)
			s.sse.broadcast(slug, "progress", map[string]interface{}{
				"slug":      slug,
				"status":    "failed",
				"error":     update.Error,
				"timestamp": time.Now().Unix(),
			})
		case "completed":
			nodeOutputs[update.NodeID] = update.Output
			if update.NodeID == "generate_article" {
				generatedOutput = update.Output
			}
			log.Printf("✓ [generate] node %s completed", update.NodeID)
			s.streamNodeOutputs(slug, update.NodeID, update.Output)
		}
	}

	if pipelineFailed || ctx.Err() != nil {
		reason := "a pipeline node failed"
		if ctx.Err() != nil {
			reason = "generation timed out"
		}
		s.failArticle(slug, reason)
		return fmt.Errorf("%s", reason)
	}

	// Unify claim identity before anything persists: model-minted IDs are
	// unstable across runs and the writer fabricates anchors, so anchors can
	// dangle ("unknown" chips) and regens accumulate duplicate rows.
	logNodeShapes(slug, nodeOutputs)
	generatedOutput = s.canonicalizeClaimIDs(nodeOutputs, generatedOutput)
	// ponytail: one writer retry on lint signal (same arming pattern as
	// contestNote) + citation verification sampling on weak claims.
	generatedOutput = s.retryWriterOnLint(slug, note, nodeOutputs, generatedOutput)
	s.verifySampleWeakClaims(slug, nodeOutputs)

	art, ok := transformGeneratedArticle(slug, generatedOutput)
	if !ok {
		s.failArticle(slug, "generate_article produced no usable output")
		return fmt.Errorf("generate_article produced no usable output")
	}
	s.backfillCitationURLs(slug, nodeOutputs, art)
	if err := s.db.SaveArticle(art); err != nil {
		reason := fmt.Sprintf("save article: %v", err)
		s.failArticle(slug, reason)
		return fmt.Errorf("%s", reason)
	}

	// Fresh link set per generation (rows + versions are preserved — only
	// the junction is reset so stale links from prior runs can't linger).
	if err := s.db.ClearArticleClaimLinks(slug); err != nil {
		log.Printf("[generate] clear stale links %s: %v", slug, err)
	}

	// Epistemic persistence — save claims, evidence, gaps, language flags,
	// and scrutiny assessments from intermediate DAG node outputs.
	// Non-fatal: article is already saved; log errors and continue.
	s.persistNodeOutputs(slug, nodeOutputs)

	// Visuals — hero + section illustrations, DB-backed. Non-fatal:
	// the article ships text-only when the key is unset or calls fail.
	s.generateArticleImages(slug, art)

	_ = s.db.SaveJob(slug, "done", "store", map[string]interface{}{"title": art.Title})

	s.sse.broadcast(slug, "article_complete", map[string]interface{}{
		"slug":               slug,
		"article_id":         slug,
		"title":              art.Title,
		"derived_confidence": art.DerivedConfidence,
		"timestamp":          time.Now().Unix(),
	})
	log.Printf("✓ [generate] complete slug=%s title=%q in %s", slug, art.Title, time.Since(start).Round(time.Millisecond))

	// Fire-and-forget revalidation so the static article page + dashboards
	// reflect the fresh content without waiting for the 60s ISR window. The
	// frontend handles this via POST /api/revalidate with a shared secret.
	s.notifyFrontendRevalidate(slug)
	return nil
}

// backfillCitationURLs fills empty citation URLs from the retrieve node's
// documents. The writer cites sources as bare doc IDs ("doc-4302a327") with
// empty urls, which render as dead links; the real URLs sit one node away.
// Mechanical title/id match — no LLM round-trip. Non-fatal by design.
func (s *Server) backfillCitationURLs(slug string, nodeOutputs map[string]interface{}, art *storage.Article) {
	if len(art.Citations) == 0 {
		return
	}
	raw, ok := nodeOutputs["retrieve"]
	if !ok {
		return
	}
	var result struct {
		Documents map[string][]struct {
			ID    string `json:"id"`
			Title string `json:"title"`
			URL   string `json:"url"`
		} `json:"documents"`
	}
	b, _ := json.Marshal(raw)
	if err := json.Unmarshal(b, &result); err != nil {
		return
	}
	byID := map[string]string{}
	byTitle := map[string]string{}
	for _, docs := range result.Documents {
		for _, d := range docs {
			if d.URL == "" {
				continue
			}
			if d.ID != "" {
				byID[strings.ToLower(d.ID)] = d.URL
			}
			if d.Title != "" {
				byTitle[strings.ToLower(d.Title)] = d.URL
			}
		}
	}
	if len(byID) == 0 && len(byTitle) == 0 {
		return
	}
	fixed := 0
	for i := range art.Citations {
		if strings.TrimSpace(art.Citations[i].URL) != "" {
			continue
		}
		t := strings.ToLower(strings.TrimSpace(art.Citations[i].Title))
		if u, ok := byID[t]; ok {
			art.Citations[i].URL = u
			fixed++
			continue
		}
		for title, u := range byTitle {
			if title != "" && (strings.Contains(t, title) || strings.Contains(title, t)) {
				art.Citations[i].URL = u
				fixed++
				break
			}
		}
	}
	if fixed > 0 {
		log.Printf("[generate] slug=%s: backfilled %d/%d citation URLs", slug, fixed, len(art.Citations))
	}
}

// notifyFrontendRevalidate POSTs to the Next.js revalidation endpoint in a
// background goroutine. Failures are logged and ignored — the ISR window is
// the safety net.
func (s *Server) notifyFrontendRevalidate(slug string) {
	// ponytail: REVALIDATE_URL is the server-side frontend base
	// (in compose: http://frontend:3000). NEXT_PUBLIC_API_URL is the
	// browser-facing API base and points at the backend itself.
	apiURL := os.Getenv("REVALIDATE_URL")
	if apiURL == "" {
		apiURL = os.Getenv("NEXT_PUBLIC_API_URL")
	}
	secret := os.Getenv("REVALIDATE_SECRET")
	if apiURL == "" || secret == "" {
		return
	}
	go func() {
		body, _ := json.Marshal(map[string]string{"slug": slug})
		req, err := http.NewRequest("POST", apiURL+"/api/revalidate", bytes.NewReader(body))
		if err != nil {
			log.Printf("[revalidate] build request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Revalidate-Secret", secret)
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[revalidate] call %s: %v", apiURL, err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Printf("[revalidate] non-2xx status=%d slug=%s", resp.StatusCode, slug)
			return
		}
		log.Printf("[revalidate] ok slug=%s", slug)
	}()
}

// failArticle marks the job as errored and notifies subscribers.
func (s *Server) failArticle(slug string, reason string) {
	_ = s.db.SaveJob(slug, "error", "error", map[string]interface{}{"title": slug, "error": reason})
	s.sse.broadcast(slug, "progress", map[string]interface{}{
		"slug":      slug,
		"phase":     "error",
		"status":    "failed",
		"error":     reason,
		"timestamp": time.Now().Unix(),
	})
	log.Printf("💥 [generate] failed slug=%s: %s", slug, reason)
}

// streamNodeOutputs broadcasts per-item events from a node's output to the live
// SSE channel so the article page can show the claim graph assembling in real
// time. Runs in a goroutine with a small inter-event delay so the frontend
// renders events with visible spacing instead of a single burst.
func (s *Server) streamNodeOutputs(slug string, nodeID string, raw interface{}) {
	if raw == nil {
		return
	}
	events := extractLiveEvents(nodeID, raw)
	if len(events) == 0 {
		return
	}
	go func() {
		for _, ev := range events {
			s.sse.broadcast(slug, "agent_event", ev)
			time.Sleep(70 * time.Millisecond)
		}
	}()
}

func mkEvent(typ, label string, data map[string]interface{}, ts int64) map[string]interface{} {
	return map[string]interface{}{
		"type":      typ,
		"label":     label,
		"data":      data,
		"timestamp": ts,
	}
}

// extractLiveEvents turns a node's raw LLM output into a flat list of broadcast
// events in the AgentEvent shape ({type, label, data, timestamp}). The frontend
// EpisodeFeed renders each event as a card. ponytail: per-node JSON parsing is
// cheaper than streaming partial JSON from the LLM, and the visible spacing
// comes from the server-side delay in streamNodeOutputs.
func extractLiveEvents(nodeID string, raw interface{}) []map[string]interface{} {
	now := time.Now().Unix()
	b, err := json.Marshal(raw)
	if err != nil {
		return nil
	}
	var out []map[string]interface{}

	switch nodeID {
	case "retrieve":
		var r struct {
			Documents map[string][]struct {
				ID    string `json:"id"`
				Title string `json:"title"`
				URL   string `json:"url"`
			} `json:"documents"`
			Plan    []string `json:"research_plan"`
			Queries []string `json:"research_queries"`
		}
		if json.Unmarshal(b, &r) == nil {
			if len(r.Plan) > 0 {
				out = append(out, mkEvent("research_plan", "plan", map[string]interface{}{
					"steps":   r.Plan,
					"queries": r.Queries,
				}, now))
			}
			for _, docs := range r.Documents {
				for _, d := range docs {
					if d.ID == "" {
						continue
					}
					out = append(out, mkEvent("source_found", "source", map[string]interface{}{
						"id":    d.ID,
						"title": d.Title,
						"url":   d.URL,
					}, now))
				}
			}
		}

	case "extract_claims":
		var r struct {
			Claims []struct {
				ClaimID string `json:"claim_id"`
				Text    string `json:"text"`
			} `json:"claims"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, c := range r.Claims {
				if c.ClaimID == "" || c.Text == "" {
					continue
				}
				out = append(out, mkEvent("claim_discovered", "claim", map[string]interface{}{
					"id":   c.ClaimID,
					"text": c.Text,
				}, now))
			}
		}

	case "map_evidence":
		var r struct {
			Mappings []struct {
				ClaimID       string   `json:"claim_id"`
				Supporting    []string `json:"supporting"`
				Contradicting []string `json:"contradicting"`
			} `json:"claim_evidence_map"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, m := range r.Mappings {
				if m.ClaimID == "" {
					continue
				}
				out = append(out, mkEvent("evidence_mapped", "evidence", map[string]interface{}{
					"claim_id":      m.ClaimID,
					"supporting":    len(m.Supporting),
					"contradicting": len(m.Contradicting),
				}, now))
			}
		}

	case "detect_missing":
		var r struct {
			Gaps []struct {
				EvidenceID       string `json:"evidence_id"`
				ExpectedArtifact string `json:"expected_artifact"`
				CauseLabel       string `json:"cause_label"`
			} `json:"gaps"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, g := range r.Gaps {
				if g.EvidenceID == "" {
					continue
				}
				out = append(out, mkEvent("gap_detected", "gap", map[string]interface{}{
					"id":       g.EvidenceID,
					"artifact": g.ExpectedArtifact,
					"cause":    g.CauseLabel,
				}, now))
			}
		}

	case "scrutinize":
		var r struct {
			Assessments []struct {
				ClaimID   string  `json:"claim_id"`
				RiskScore float64 `json:"risk_score"`
			} `json:"risk_assessments"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, a := range r.Assessments {
				if a.ClaimID == "" {
					continue
				}
				out = append(out, mkEvent("claim_scrutinized", "scrutiny", map[string]interface{}{
					"claim_id": a.ClaimID,
					"risk":     a.RiskScore,
				}, now))
			}
		}

	case "resolve":
		var r struct {
			ResolvedClaims []struct {
				ClaimID           string  `json:"claim_id"`
				Status            string  `json:"status"`
				DerivedConfidence float64 `json:"derived_confidence"`
			} `json:"resolved_claims"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, c := range r.ResolvedClaims {
				if c.ClaimID == "" {
					continue
				}
				out = append(out, mkEvent("claim_resolved", "resolution", map[string]interface{}{
					"id":         c.ClaimID,
					"status":     c.Status,
					"confidence": c.DerivedConfidence,
				}, now))
			}
		}

	case "generate_article":
		var r struct {
			Article struct {
				Sections []struct {
					ID      string `json:"id"`
					Title   string `json:"title"`
					Content string `json:"content"`
				} `json:"sections"`
			} `json:"article"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, s := range r.Article.Sections {
				if s.ID == "" {
					continue
				}
				preview := s.Content
				if len(preview) > 220 {
					preview = preview[:220] + "…"
				}
				out = append(out, mkEvent("article_section", "section", map[string]interface{}{
					"id":      s.ID,
					"title":   s.Title,
					"preview": preview,
				}, now))
			}
		}
	}

	return out
}

// articlePayload mirrors the generate_article node output:
// `{article: {title, abstract, sections[], timeline[], categories[], crossrefs[], citations[]}}`.
type articlePayload struct {
	Article struct {
		Title      string                   `json:"title"`
		Abstract   string                   `json:"abstract"`
		Summary    string                   `json:"summary"` // legacy/mock field; used iff Abstract is empty
		Sections   []storage.Section        `json:"sections"`
		Timeline   []storage.TimelineEvent  `json:"timeline"`
		Categories []string                 `json:"categories"`
		Crossrefs  []storage.CrossReference `json:"crossrefs"`
		Citations  []storage.Citation       `json:"citations"`
		Confidence map[string]interface{}   `json:"confidence_vector,omitempty"`
		Derived    float64                  `json:"derived_confidence,omitempty"`
	} `json:"article"`
}

// transformGeneratedArticle converts the raw generate_article node output
// into a storage.Article. Returns false when the output is missing or
// malformed — callers must fail loudly instead of publishing a stub as
// "published" (that masqueraded failure as success).
func transformGeneratedArticle(slug string, raw interface{}) (*storage.Article, bool) {
	// Re-marshal through JSON so map[string]interface{} and typed structs both
	// decode cleanly into articlePayload regardless of which path produced it.
	rawBytes, err := json.Marshal(raw)
	if err != nil || len(rawBytes) == 0 {
		log.Printf("💥 [generate] empty/malformed article output for slug=%s", slug)
		return nil, false
	}

	var payload articlePayload
	if err := json.Unmarshal(rawBytes, &payload); err != nil || payload.Article.Title == "" {
		log.Printf("💥 [generate] could not parse article output for slug=%s (err=%v)", slug, err)
		return nil, false
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
	}, true
}

// persistNodeOutputs saves intermediate DAG node outputs (claims, evidence gaps,
// language flags, scrutiny assessments) to the epistemic tables. Non-fatal:
// errors are logged but the article save is unaffected.
func (s *Server) persistNodeOutputs(slug string, outputs map[string]interface{}) {
	now := time.Now().UTC()

	// Retrieval doc registry: step 1 re-attaches URL + source when a
	// mapping references a retrieved doc. Without this the step-1 upsert
	// (full-row overwrite) would clobber the step-0 URL with "".
	docURL := map[string]string{}
	docSource := map[string]string{}

	// Claims first: evidence links, gaps, flags, and scrutiny all carry a
	// claim_id FK. Persisting claims before anything that references them
	// turns a total FK wipeout (23503 on every link) into linked rows.
	// 0. extract_claims → save claims + link to article (with signature dedup)
	if raw, ok := outputs["extract_claims"]; ok {
		var result struct {
			Claims []struct {
				ClaimID string `json:"claim_id"`
				Text    string `json:"text"`
			} `json:"claims"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] extract_claims: %d claims", len(result.Claims))
			if len(result.Claims) == 0 {
				warnEmpty("extract_claims", raw)
			}
			for _, c := range result.Claims {
				if c.ClaimID == "" || c.Text == "" {
					continue
				}
				sig := storage.ClaimSignature(c.Text)
				existing, err := s.db.GetClaimBySignature(sig)
				if err != nil {
					log.Printf("[epistemic] dedup check %s: %v", c.ClaimID, err)
				}
				if existing != nil {
					if err := s.db.LinkArticleClaim(slug, existing.ID); err != nil {
						log.Printf("[epistemic] link dedup %s: %v", existing.ID, err)
					}
					continue
				}
				if err := s.db.SaveClaim(&storage.Claim{
					ID:        c.ClaimID,
					Text:      c.Text,
					Signature: sig,
					Type:      "factual",
					Status:    "unknown",
					CreatedAt: now,
					UpdatedAt: now,
				}); err != nil {
					log.Printf("[epistemic] save claim %s: %v", c.ClaimID, err)
					continue
				}
				if err := s.db.LinkArticleClaim(slug, c.ClaimID); err != nil {
					log.Printf("[epistemic] link claim %s: %v", c.ClaimID, err)
				}
			}
		} else {
			log.Printf("[epistemic] parse extract_claims: %v", err)
		}
	}

	// 1. retrieve → save evidence items
	if raw, ok := outputs["retrieve"]; ok {
		var result struct {
			Documents map[string][]struct {
				ID    string `json:"id"`
				Title string `json:"title"`
				Text  string `json:"text"`
				URL   string `json:"url"`
			} `json:"documents"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			ndocs := 0
			for _, docs := range result.Documents {
				ndocs += len(docs)
			}
			log.Printf("[epistemic] retrieve: %d documents in %d buckets", ndocs, len(result.Documents))
			if ndocs == 0 {
				warnEmpty("retrieve", raw)
			}
			for _, docs := range result.Documents {
				for _, d := range docs {
					if d.ID == "" {
						continue
					}
					// IDs are hashed into UUID shape: sources.id and
					// evidence.id/source_id are UUID columns (22P02
					// otherwise), and the deterministic mapping lets
					// step-1 claim links upsert-merge onto these rows.
					sourceID := stableUUID("source:" + d.ID)
					docURL[d.ID] = d.URL
					docSource[d.ID] = sourceID
					// Save as source
					if err := s.db.SaveSource(&storage.Source{
						ID:   sourceID,
						Name: d.Title,
						Type: "institutional",
					}); err != nil {
						log.Printf("[epistemic] save source %s: %v", d.ID, err)
					}
					// Save as evidence
					evID := stableUUID(d.ID + "-ev")
					if err := s.db.SaveEvidence(&storage.Evidence{
						ID:                evID,
						Type:              "primary_document",
						URL:               d.URL,
						ChainOfCustody:    "unverified",
						AcquisitionMethod: "retrieval",
						Accessibility:     "public",
						SupportsClaim:     true,
						SourceID:          &sourceID,
						CreatedAt:         now,
					}); err != nil {
						log.Printf("[epistemic] save evidence %s: %v", evID, err)
					}
				}
			}
		} else {
			log.Printf("[epistemic] parse retrieve: %v", err)
		}
	}

	// 2. map_evidence → link evidence to claims (parents exist per step 0)
	if raw, ok := outputs["map_evidence"]; ok {
		var result struct {
			ClaimEvidenceMap []struct {
				ClaimID       string   `json:"claim_id"`
				Supporting    []string `json:"supporting"`
				Contradicting []string `json:"contradicting"`
			} `json:"claim_evidence_map"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] map_evidence: %d mappings", len(result.ClaimEvidenceMap))
			if len(result.ClaimEvidenceMap) == 0 {
				warnEmpty("map_evidence", raw)
			}
			for _, m := range result.ClaimEvidenceMap {
				if m.ClaimID == "" {
					continue
				}
				// Unhealable claim refs (model fabrications the alias pass
				// couldn't stabilize — no wording to work from) would die
				// as 22P02 or FK violations; drop them loudly instead.
				if !isUUID(m.ClaimID) {
					log.Printf("[epistemic] map_evidence: dropping mapping for non-UUID claim ref %q", m.ClaimID)
					continue
				}
				// Same hash as step 0 (eid+"-ev") so claim links merge onto
				// the retrieval rows carrying URL + source instead of
				// forking bare duplicates.
				linkEvidence := func(eid string, supports bool) {
					evID := stableUUID(eid + "-ev")
					ev := &storage.Evidence{
						ID:            evID,
						ClaimID:       m.ClaimID,
						Type:          "primary_document",
						SupportsClaim: supports,
						CreatedAt:     now,
					}
					// Re-attach provenance: the upsert overwrites the whole
					// row, so a bare link would wipe the step-0 URL.
					if u, ok := docURL[eid]; ok {
						ev.URL = u
						ev.ChainOfCustody = "unverified"
						ev.AcquisitionMethod = "retrieval"
						ev.Accessibility = "public"
					}
					if src, ok := docSource[eid]; ok {
						s := src
						ev.SourceID = &s
					}
					if err := s.db.SaveEvidence(ev); err != nil {
						log.Printf("[epistemic] save evidence %s: %v", evID, err)
					}
				}
				for _, eid := range m.Supporting {
					linkEvidence(eid, true)
				}
				for _, eid := range m.Contradicting {
					linkEvidence(eid, false)
				}
			}
		} else {
			log.Printf("[epistemic] parse map_evidence: %v", err)
		}
	}

	// (extract_claims persisted as step 0 — FK parents first; see above)

	// 3. resolve → update claim status, confidence_vector, derived_confidence
	if raw, ok := outputs["resolve"]; ok {
		var result struct {
			ResolvedClaims []struct {
				ClaimID           string                 `json:"claim_id"`
				Text              string                 `json:"text"`
				Status            string                 `json:"status"`
				ConfidenceVector  map[string]interface{} `json:"confidence_vector"`
				DerivedConfidence float64                `json:"derived_confidence"`
			} `json:"resolved_claims"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] resolve: %d resolved claims", len(result.ResolvedClaims))
			if len(result.ResolvedClaims) == 0 {
				warnEmpty("resolve", raw)
			}
			runID := storage.EnsureGenerationRunID()
			for _, rc := range result.ResolvedClaims {
				if rc.ClaimID == "" {
					continue
				}
				// Assessment-only write: the resolver owns status/vector,
				// never identity (text/signature/type). A full-row upsert
				// with a blank type trips the CHECK constraint and drops
				// every verdict silently — the unknowns bug.
				if err := s.db.UpdateClaimResolution(rc.ClaimID, rc.Status, rc.ConfidenceVector, rc.DerivedConfidence, now); err != nil {
					log.Printf("[epistemic] resolve claim %s: %v", rc.ClaimID, err)
					continue
				}
				if err := s.db.SaveClaimVersion(rc.ClaimID, runID, rc.ConfidenceVector, rc.DerivedConfidence); err != nil {
					log.Printf("[epistemic] save version %s: %v", rc.ClaimID, err)
				}
				// Link resolved claims that carry wording so their anchors
				// resolve. Textless resolve-only IDs are never linked (a chip
				// opening an empty claim is worse than no chip) and their
				// anchors are stripped by canonicalization instead.
				if rc.Text != "" {
					if err := s.db.LinkArticleClaim(slug, rc.ClaimID); err != nil {
						log.Printf("[epistemic] link resolved claim %s: %v", rc.ClaimID, err)
					}
				}
			}
		} else {
			log.Printf("[epistemic] parse resolve: %v", err)
		}
	}

	// 3b. resolve → persist claim→claim relationships (supports/contradicts/related)
	if raw, ok := outputs["resolve"]; ok {
		var result struct {
			Relationships []struct {
				SourceClaimID    string  `json:"source_claim_id"`
				TargetClaimID    string  `json:"target_claim_id"`
				RelationshipType string  `json:"relationship_type"`
				Strength         float64 `json:"strength"`
			} `json:"claim_relationships"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] resolve relationships: %d", len(result.Relationships))
			if len(result.Relationships) == 0 {
				warnEmpty("claim_relationships", raw)
			}
			for _, rel := range result.Relationships {
				if rel.SourceClaimID == "" || rel.TargetClaimID == "" || rel.SourceClaimID == rel.TargetClaimID {
					continue
				}
				switch rel.RelationshipType {
				case "supports", "contradicts", "related":
				default:
					continue
				}
				if err := s.db.SaveClaimRelationship(rel.SourceClaimID, rel.TargetClaimID, rel.RelationshipType, rel.Strength); err != nil {
					log.Printf("[epistemic] save relationship %s→%s: %v", rel.SourceClaimID, rel.TargetClaimID, err)
				}
			}
		} else {
			log.Printf("[epistemic] parse claim_relationships: %v", err)
		}
	}

	// 4. detect_missing → save evidence gaps
	if raw, ok := outputs["detect_missing"]; ok {
		var result struct {
			Gaps []struct {
				ClaimID            string  `json:"claim_id"`
				EvidenceID         string  `json:"evidence_id"`
				GapType            string  `json:"gap_type"`
				ExpectedArtifact   string  `json:"expected_artifact"`
				VerificationStatus string  `json:"verification_status"`
				CauseLabel         string  `json:"cause_label"`
				CauseConfidence    float64 `json:"cause_confidence"`
			} `json:"gaps"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] detect_missing: %d gaps", len(result.Gaps))
			if len(result.Gaps) == 0 {
				warnEmpty("detect_missing", raw)
			}
			for _, g := range result.Gaps {
				// Gaps join to articles via claim_id — unlinked rows are
				// invisible everywhere, and non-UUID refs die as 22P02.
				if !isUUID(g.ClaimID) {
					log.Printf("[epistemic] detect_missing: dropping gap with unresolvable claim ref %q", g.ClaimID)
					continue
				}
				id := stableUUID(g.ClaimID + "|" + g.GapType + "|" + g.ExpectedArtifact + "|" + g.VerificationStatus)
				if err := s.db.SaveEvidenceGap(&storage.EvidenceGap{
					ID:                 id,
					ClaimID:            g.ClaimID,
					GapType:            g.GapType,
					ExpectedArtifact:   g.ExpectedArtifact,
					VerificationStatus: g.VerificationStatus,
					CauseLabel:         g.CauseLabel,
					CauseConfidence:    g.CauseConfidence,
					DetectedAt:         now,
				}); err != nil {
					log.Printf("[epistemic] save gap %s: %v", id, err)
				}
			}
		} else {
			log.Printf("[epistemic] parse detect_missing: %v", err)
		}
	}

	// 5. map_language → save language flags
	if raw, ok := outputs["map_language"]; ok {
		var result struct {
			Flags []struct {
				ClaimID          string  `json:"claim_id"`
				SourcePhrase     string  `json:"source_phrase"`
				PrecisionUpgrade string  `json:"precision_upgrade"`
				FramingOrigin    string  `json:"framing_origin"`
				FramingFunction  string  `json:"framing_function"`
				Confidence       float64 `json:"confidence"`
			} `json:"language_flags"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] map_language: %d flags", len(result.Flags))
			if len(result.Flags) == 0 {
				warnEmpty("map_language", raw)
			}
			for _, f := range result.Flags {
				if f.ClaimID == "" {
					continue
				}
				if !isUUID(f.ClaimID) {
					log.Printf("[epistemic] map_language: dropping flag with non-UUID claim ref %q", f.ClaimID)
					continue
				}
				// Deterministic per (claim, phrase): regens upsert instead
				// of accumulating, and the ID satisfies the UUID column.
				id := stableUUID(f.ClaimID + "-lang-" + f.SourcePhrase)
				if err := s.db.SaveLanguageFlag(&storage.LanguageFlag{
					ID:               id,
					ClaimID:          f.ClaimID,
					SourcePhrase:     f.SourcePhrase,
					PrecisionUpgrade: f.PrecisionUpgrade,
					FramingOrigin:    f.FramingOrigin,
					FramingFunction:  f.FramingFunction,
					Confidence:       f.Confidence,
					DetectedAt:       now,
				}); err != nil {
					log.Printf("[epistemic] save language flag %s: %v", id, err)
				}
			}
		} else {
			log.Printf("[epistemic] parse map_language: %v", err)
		}
	}

	// 6. scrutinize → save scrutiny assessments
	if raw, ok := outputs["scrutinize"]; ok {
		var result struct {
			Assessments []struct {
				ClaimID     string   `json:"claim_id"`
				RiskFactors []string `json:"risk_factors"`
				RiskScore   float64  `json:"risk_score"`
				Action      struct {
					RequiresExtraCorroboration bool     `json:"requires_extra_corroboration"`
					ExcludedEvidenceIDs        []string `json:"excluded_evidence_ids"`
					MinimumIndependentSources  int      `json:"minimum_independent_sources"`
				} `json:"action"`
			} `json:"risk_assessments"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			log.Printf("[epistemic] scrutinize: %d assessments", len(result.Assessments))
			if len(result.Assessments) == 0 {
				warnEmpty("scrutinize", raw)
			}
			for _, a := range result.Assessments {
				if a.ClaimID == "" {
					continue
				}
				if !isUUID(a.ClaimID) {
					log.Printf("[epistemic] scrutinize: dropping assessment with non-UUID claim ref %q", a.ClaimID)
					continue
				}
				id := stableUUID(a.ClaimID + "-scr")
				rf := make(map[string]interface{})
				for i, f := range a.RiskFactors {
					rf[fmt.Sprintf("factor_%d", i)] = f
				}
				ar := map[string]interface{}{
					"requires_extra_corroboration": a.Action.RequiresExtraCorroboration,
					"excluded_evidence_ids":        a.Action.ExcludedEvidenceIDs,
					"minimum_independent_sources":  a.Action.MinimumIndependentSources,
				}
				if err := s.db.SaveScrutinyAssessment(&storage.ScrutinyAssessment{
					ID:             id,
					ClaimID:        a.ClaimID,
					RiskFactors:    rf,
					RiskScore:      a.RiskScore,
					ActionRequired: ar,
					AssessedAt:     now,
				}); err != nil {
					log.Printf("[epistemic] save scrutiny %s: %v", id, err)
				}
			}
		} else {
			log.Printf("[epistemic] parse scrutinize: %v", err)
		}
	}
}

// promoteKey moves an alternate top-level key to the canonical one when the
// canonical key is absent. Models paraphrase key names as well as values;
// without this, a perfectly good output unmarshals into zero values and
// every downstream persist step silently saves nothing.
func promoteKey(m map[string]interface{}, want string, alts ...string) bool {
	if m == nil {
		return false
	}
	if v, ok := m[want]; ok {
		if list, ok := v.([]interface{}); ok && len(list) > 0 {
			return false // canonical present and non-empty; nothing to do
		}
	}
	for _, alt := range alts {
		if v, ok := m[alt]; ok {
			if list, ok := v.([]interface{}); ok && len(list) > 0 {
				m[want] = v
				delete(m, alt)
				log.Printf("[generate] key promoted: %s -> %s (%d items)", alt, want, len(list))
				return true
			}
		}
	}
	return false
}

// logNodeShapes records each node's top-level keys on every run. Combined
// with the per-section parsed counts in persist, this makes silent schema
// drift visible in Heroku logs instead of discoverable from screenshots.
func logNodeShapes(slug string, nodeOutputs map[string]interface{}) {
	for _, name := range []string{"retrieve", "extract_claims", "map_evidence", "critique", "detect_missing", "map_language", "scrutinize", "resolve", "generate_article"} {
		raw, ok := nodeOutputs[name]
		if !ok {
			log.Printf("[generate] shape %s: MISSING", name)
			continue
		}
		b, _ := json.Marshal(raw)
		if len(b) > 160 {
			b = b[:160]
		}
		log.Printf("[generate] shape %s: %s", name, strings.TrimSpace(string(b)))
	}
}

// warnEmpty logs what a section actually contained when parsing yielded
// nothing — the difference between "model said nothing" and "model said
// it under a different key".
func warnEmpty(section string, raw interface{}) {
	b, _ := json.Marshal(raw)
	present := len(b) > 0 && string(b) != "null" && string(b) != "{}" && string(b) != "[]"
	status := "absent"
	if present {
		status = "present-but-unparsed"
		if len(b) > 240 {
			b = b[:240]
		}
		log.Printf("[epistemic] WARN %s: 0 items parsed; raw: %s", section, strings.TrimSpace(string(b)))
	} else {
		log.Printf("[epistemic] WARN %s: 0 items parsed; raw %s", section, status)
	}
}

// reformatting its signature hash into UUID shape. Same wording always maps
// to the same ID — across nodes, regenerations, and runs — so re-running the
// pipeline upserts rows (with version history) instead of accumulating
// duplicates, and anchors stay valid. Different wording maps differently,
// which is correct: different wording is a different claim.
func canonicalClaimID(text string) string {
	sig := storage.ClaimSignature(text) // 32 hex chars
	return sig[0:8] + "-" + sig[8:12] + "-" + sig[12:16] + "-" + sig[16:20] + "-" + sig[20:32]
}

var claimAnchorRe = regexp.MustCompile(`\[claim:([0-9a-fA-F-]+)\]`)

// claimItemList extracts the object list under key from a node output.
func claimItemList(raw interface{}, key string) []map[string]interface{} {
	m, ok := raw.(map[string]interface{})
	if !ok {
		return nil
	}
	list, ok := m[key].([]interface{})
	if !ok {
		return nil
	}
	var out []map[string]interface{}
	for _, it := range list {
		if cm, ok := it.(map[string]interface{}); ok {
			out = append(out, cm)
		}
	}
	return out
}

func strField(m map[string]interface{}, f string) string {
	s, _ := m[f].(string)
	return s
}

// canonicalizeClaimIDs rewrites model-minted claim IDs to stable identities
// across extract + resolve outputs and the generated article, and strips
// anchors that resolve to nothing. Verified failure modes it heals:
// extract/resolve minting sequential placeholder IDs that drift between runs
// (duplicate rows, stale anchors), and the writer fabricating anchor IDs
// that exist nowhere. Dropped and stripped items are logged; the article
// text is rewritten, node outputs are fixed in place.
func (s *Server) canonicalizeClaimIDs(nodeOutputs map[string]interface{}, generated interface{}) interface{} {
	// finalID returns the stable identity for a claim: the surviving row's
	// ID when the wording already exists (regenerations upsert with version
	// history instead of forking duplicate rows), else the deterministic
	// canonical ID so future runs converge. Falls back to the model ID when
	// there is no wording to work with.
	finalID := func(modelID, text string) string {
		if text == "" {
			return modelID
		}
		canon := canonicalClaimID(text)
		if modelID == canon {
			return canon
		}
		if row, err := s.db.GetClaimBySignature(storage.ClaimSignature(text)); err == nil && row != nil && row.ID != "" {
			return row.ID
		}
		return canon
	}

	alias := map[string]string{} // unstable model ID -> stable identity

	// Normalize alternate top-level keys before anything reads them, so one
	// paraphrased key can't hollow out every downstream consumer at once.
	if m, ok := nodeOutputs["map_evidence"].(map[string]interface{}); ok {
		promoteKey(m, "claim_evidence_map", "evidence_map", "mappings", "map")
	}
	if m, ok := nodeOutputs["detect_missing"].(map[string]interface{}); ok {
		promoteKey(m, "gaps", "evidence_gaps", "missing_gaps")
	}
	if m, ok := nodeOutputs["scrutinize"].(map[string]interface{}); ok {
		promoteKey(m, "risk_assessments", "assessments", "risks")
	}
	if m, ok := nodeOutputs["map_language"].(map[string]interface{}); ok {
		promoteKey(m, "language_flags", "flags")
	}
	if m, ok := nodeOutputs["resolve"].(map[string]interface{}); ok {
		promoteKey(m, "resolved_claims", "claims", "resolutions")
		promoteKey(m, "claim_relationships", "relationships")
	}

	// Extract claims: identity flows from the wording.
	for _, c := range claimItemList(nodeOutputs["extract_claims"], "claims") {
		id, text := strField(c, "claim_id"), strField(c, "text")
		if id == "" || text == "" {
			continue
		}
		if stable := finalID(id, text); stable != id {
			alias[id] = stable
			c["claim_id"] = stable
		}
	}
	// Resolved claims: alias by ID, else stabilize from their own text
	// (post-backfill they carry it) so resolve-minted IDs heal too.
	// ID-less items with wording are ASSIGNED their stable identity here —
	// otherwise they save as orphans no anchor can ever reach.
	for _, c := range claimItemList(nodeOutputs["resolve"], "resolved_claims") {
		id := strField(c, "claim_id")
		if id == "" {
			if text := strField(c, "text"); text != "" {
				stable := finalID("", text)
				c["claim_id"] = stable
				log.Printf("[generate] orphan resolved claim adopted as %s", stable)
			}
			continue
		}
		if stable, ok := alias[id]; ok {
			c["claim_id"] = stable
			continue
		}
		if stable := finalID(id, strField(c, "text")); stable != id {
			alias[id] = stable
			c["claim_id"] = stable
		}
	}
	// Every other claim_id reference in the epistemic outputs follows the alias.
	rewriteClaimRefs(nodeOutputs["resolve"], alias)
	rewriteClaimRefs(nodeOutputs["map_evidence"], alias)
	rewriteClaimRefs(nodeOutputs["detect_missing"], alias)
	rewriteClaimRefs(nodeOutputs["scrutinize"], alias)
	rewriteClaimRefs(nodeOutputs["map_language"], alias)

	// Valid set = IDs that will actually be linked: extract claims and
	// resolved claims that carry wording. Textless IDs are never linked, so
	// counting them here is what let dangling anchors through as "unknown".
	valid := map[string]bool{}
	for _, raw := range nodeOutputs {
		for _, c := range claimItemList(raw, "claims") {
			if id := strField(c, "claim_id"); id != "" && strField(c, "text") != "" {
				valid[id] = true
			}
		}
		for _, c := range claimItemList(raw, "resolved_claims") {
			if id := strField(c, "claim_id"); id != "" && strField(c, "text") != "" {
				valid[id] = true
			}
		}
	}

	// Article JSON: rewrite aliased anchors, strip dangling ones.
	b, err := json.Marshal(generated)
	if err != nil {
		return generated
	}
	txt := string(b)
	for old, canon := range alias {
		txt = strings.ReplaceAll(txt, "[claim:"+old+"]", "[claim:"+canon+"]")
	}
	stripped := 0
	txt = claimAnchorRe.ReplaceAllStringFunc(txt, func(mk string) string {
		mm := claimAnchorRe.FindStringSubmatch(mk)
		if len(mm) == 2 && valid[mm[1]] {
			return mk
		}
		stripped++
		return ""
	})
	if len(alias) > 0 || stripped > 0 {
		log.Printf("[generate] canonicalize: %d ids remapped, %d dangling anchors stripped", len(alias), stripped)
	}
	var out interface{}
	if err := json.Unmarshal([]byte(txt), &out); err != nil {
		return generated
	}
	return out
}

// rewriteClaimRefs remaps claim_id / source_claim_id / target_claim_id
// fields inside a node output via the alias map. Evidence references
// (supporting/contradicting ID lists) are document IDs, not claim IDs,
// and are deliberately left alone.
func rewriteClaimRefs(raw interface{}, alias map[string]string) {
	if len(alias) == 0 {
		return
	}
	m, ok := raw.(map[string]interface{})
	if !ok {
		return
	}
	remapList := func(key string, fields ...string) {
		list, ok := m[key].([]interface{})
		if !ok {
			return
		}
		for _, it := range list {
			cm, ok := it.(map[string]interface{})
			if !ok {
				continue
			}
			for _, f := range fields {
				if v, ok := alias[strField(cm, f)]; ok {
					cm[f] = v
				}
			}
		}
	}
	remapList("claim_evidence_map", "claim_id")
	remapList("gaps", "claim_id")
	remapList("risk_assessments", "claim_id")
	remapList("language_flags", "claim_id")
	remapList("claim_relationships", "source_claim_id", "target_claim_id")
}

// metaTalk patterns catch process narration leaking into article prose.
// Matches are logged, never auto-edited — mutating prose risks breaking
// anchors, and the log is what tunes the writer prompt over time.
var metaTalkPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)layer\s+[0-9]`),
	regexp.MustCompile(`(?i)interpretive assessment only`),
	regexp.MustCompile(`(?i)no .*claims were (provided|supplied)`),
	regexp.MustCompile(`(?i)no factual assertions`),
	regexp.MustCompile(`(?i)as an ai\b`),
	regexp.MustCompile(`(?i)confidence vector`),
	regexp.MustCompile(`(?i)epistemic (pipeline|layer|node)`),
	regexp.MustCompile(`(?i)resolved claim (list|set)`),
}

var sentenceSplitRe = regexp.MustCompile(`[.!?]+\s+`)
var anchorStripRe = regexp.MustCompile(`\[claim:[0-9a-fA-F-]+\]`)
var normSpaceRe = regexp.MustCompile(`[^a-z0-9 ]+`)

// stableUUID deterministically maps an arbitrary seed string into UUID
// shape (sha256 → v4 bits). Model-minted and synthetic IDs ("doc-…-ev",
// "{claim}-lang-{run}") can never satisfy UUID columns and died with 22P02,
// silently dropping every evidence row, language flag and scrutiny
// assessment. Hashing preserves the upsert-merge design (same seed → same
// row across regens, so step-0 retrieval rows merge with step-1 claim links)
// while satisfying the type.
func stableUUID(seed string) string {
	sum := sha256.Sum256([]byte(seed))
	b := sum[:16]
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

var uuidLikeRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isUUID reports whether s is safe to send to UUID columns and FK joins.
// Model-fabricated claim IDs that canonicalization couldn't heal (no wording
// to stabilize from) are dropped with a log line instead of dying as 22P02
// mid-persist — the same class as stripped anchors.
func isUUID(s string) bool { return uuidLikeRe.MatchString(s) }

// lintArticleProse scans generated prose for process narration and verbatim
// restatement. Findings are logged loudly for prompt tuning; the article is
// never mutated here (anchor safety). Returns meta-talk hits, restated-sentence
// count, and short finding lines so the caller can retry the writer once.
func lintArticleProse(slug string, generated interface{}) (metaHits, dupes int, findings []string) {
	b, err := json.Marshal(generated)
	if err != nil {
		return 0, 0, nil
	}
	var payload articlePayload
	if err := json.Unmarshal(b, &payload); err != nil {
		return 0, 0, nil
	}
	texts := []string{payload.Article.Abstract}
	for _, s := range payload.Article.Sections {
		texts = append(texts, s.Content)
	}
	for _, t := range texts {
		for _, re := range metaTalkPatterns {
			if loc := re.FindStringIndex(t); loc != nil {
				start := loc[0] - 60
				if start < 0 {
					start = 0
				}
				end := loc[1] + 60
				if end > len(t) {
					end = len(t)
				}
				excerpt := strings.TrimSpace(t[start:end])
				log.Printf("[generate] lint slug=%s meta-talk %q near: …%s…", slug, re.String(), excerpt)
				metaHits++
				if len(findings) < 6 {
					findings = append(findings, "meta-talk "+re.String()+" near: "+excerpt)
				}
			}
		}
	}
	seen := map[string]int{}
	for _, t := range texts {
		clean := anchorStripRe.ReplaceAllString(t, " ")
		for _, s := range sentenceSplitRe.Split(clean, -1) {
			norm := normSpaceRe.ReplaceAllString(strings.ToLower(s), " ")
			norm = strings.Join(strings.Fields(norm), " ")
			if len(strings.Fields(norm)) < 8 {
				continue
			}
			seen[norm]++
		}
	}
	for sent, n := range seen {
		if n >= 2 {
			dupes++
			if dupes <= 3 {
				preview := sent
				if len(preview) > 100 {
					preview = preview[:100] + "…"
				}
				log.Printf("[generate] lint slug=%s restated x%d: %q", slug, n, preview)
			}
		}
	}
	if dupes > 3 {
		log.Printf("[generate] lint slug=%s …and %d more restated sentences", slug, dupes-3)
	}
	return metaHits, dupes, findings
}

// retryWriterOnLint runs lintArticleProse and, on signal (meta-talk or heavy
// restatement), re-invokes the writer once with findings appended. Anchor-safe:
// the retry is a fresh writer pass, never a regex edit. Returns the article
// output to persist (original when clean or when the retry fails).
func (s *Server) retryWriterOnLint(slug, note string, nodeOutputs map[string]interface{}, generated interface{}) interface{} {
	metaHits, dupes, findings := lintArticleProse(slug, generated)
	if metaHits == 0 && dupes <= 3 {
		return generated
	}
	log.Printf("[generate] lint slug=%s: retrying writer once (meta=%d restated=%d)", slug, metaHits, dupes)
	retry, err := agent.RewriteArticleWithFindings(articleSystemPrompt, note, nodeOutputs["resolve"], nodeOutputs["retrieve"], nodeOutputs["extract_claims"], findings)
	if err != nil {
		log.Printf("[generate] lint slug=%s: writer retry failed (%v), keeping original", slug, err)
		return generated
	}
	retry = s.canonicalizeClaimIDs(nodeOutputs, retry)
	if m2, d2, _ := lintArticleProse(slug, retry); m2 < metaHits || d2 < dupes {
		log.Printf("[generate] lint slug=%s: retry improved (meta %d→%d restated %d→%d)", slug, metaHits, m2, dupes, d2)
		return retry
	}
	log.Printf("[generate] lint slug=%s: retry no better, keeping original", slug)
	return generated
}

// verifySampleWeakClaims runs citation verification sampling over weak claims
// (log-first, no persistence). Downgrades nothing today; the log tunes the
// resolver and writer prompts over time.
func (s *Server) verifySampleWeakClaims(slug string, nodeOutputs map[string]interface{}) {
	res, ok := nodeOutputs["resolve"]
	if !ok {
		return
	}
	for _, r := range agent.SampleVerifyWeakClaims(res, nodeOutputs["retrieve"]) {
		log.Printf("[verify-sample] slug=%s claim=%s supported=%t conf=%.2f %s", slug, r.ClaimID, r.Supported, r.Conf, r.Note)
	}
}
