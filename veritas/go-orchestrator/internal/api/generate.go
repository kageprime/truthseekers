package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
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
		return
	}

	art := transformGeneratedArticle(slug, generatedOutput)
	if err := s.db.SaveArticle(art); err != nil {
		s.failArticle(slug, fmt.Sprintf("save article: %v", err))
		return
	}

	// Epistemic persistence — save claims, evidence, gaps, language flags,
	// and scrutiny assessments from intermediate DAG node outputs.
	// Non-fatal: article is already saved; log errors and continue.
	s.persistNodeOutputs(slug, nodeOutputs)

	_ = s.db.SaveJob(slug, "done", "store", map[string]interface{}{"title": art.Title})

	BroadcastProgress(slug, "article_complete", map[string]interface{}{
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
}

// notifyFrontendRevalidate POSTs to the Next.js revalidation endpoint in a
// background goroutine. Failures are logged and ignored — the ISR window is
// the safety net.
func (s *Server) notifyFrontendRevalidate(slug string) {
	apiURL := os.Getenv("NEXT_PUBLIC_API_URL")
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
	BroadcastProgress(slug, "progress", map[string]interface{}{
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
			BroadcastProgress(slug, "agent_event", ev)
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
		}
		if json.Unmarshal(b, &r) == nil {
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
				ClaimID      string   `json:"claim_id"`
				Supporting   []string `json:"supporting"`
				Contradicting []string `json:"contradicting"`
			} `json:"claim_evidence_map"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, m := range r.Mappings {
				if m.ClaimID == "" {
					continue
				}
				out = append(out, mkEvent("evidence_mapped", "evidence", map[string]interface{}{
					"claim_id":     m.ClaimID,
					"supporting":   len(m.Supporting),
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

// persistNodeOutputs saves intermediate DAG node outputs (claims, evidence gaps,
// language flags, scrutiny assessments) to the epistemic tables. Non-fatal:
// errors are logged but the article save is unaffected.
func (s *Server) persistNodeOutputs(slug string, outputs map[string]interface{}) {
	now := time.Now().UTC()

	// 0. retrieve → save evidence items
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
			for _, docs := range result.Documents {
				for _, d := range docs {
					if d.ID == "" {
						continue
					}
					// Save as source
					if err := s.db.SaveSource(&storage.Source{
						ID:   d.ID,
						Name: d.Title,
						Type: "institutional",
					}); err != nil {
						log.Printf("[epistemic] save source %s: %v", d.ID, err)
					}
					// Save as evidence
					evID := d.ID + "-ev"
					if err := s.db.SaveEvidence(&storage.Evidence{
						ID:             evID,
						Type:           "primary_document",
						URL:            d.URL,
						ChainOfCustody: "unverified",
						AcquisitionMethod: "retrieval",
						Accessibility:  "public",
						SupportsClaim:  true,
						SourceID:       &d.ID,
						CreatedAt:      now,
					}); err != nil {
						log.Printf("[epistemic] save evidence %s: %v", evID, err)
					}
				}
			}
		} else {
			log.Printf("[epistemic] parse retrieve: %v", err)
		}
	}

	// 1. map_evidence → link evidence to claims
	if raw, ok := outputs["map_evidence"]; ok {
		var result struct {
			ClaimEvidenceMap []struct {
				ClaimID      string   `json:"claim_id"`
				Supporting   []string `json:"supporting"`
				Contradicting []string `json:"contradicting"`
			} `json:"claim_evidence_map"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			for _, m := range result.ClaimEvidenceMap {
				if m.ClaimID == "" {
					continue
				}
				for _, eid := range m.Supporting {
					evID := eid + "-ev"
					if err := s.db.SaveEvidence(&storage.Evidence{
						ID:       evID,
						ClaimID:  m.ClaimID,
						Type:     "primary_document",
						SupportsClaim: true,
						CreatedAt: now,
					}); err != nil {
						log.Printf("[epistemic] save evidence %s: %v", evID, err)
					}
				}
				for _, eid := range m.Contradicting {
					evID := eid + "-ev"
					if err := s.db.SaveEvidence(&storage.Evidence{
						ID:       evID,
						ClaimID:  m.ClaimID,
						Type:     "primary_document",
						SupportsClaim: false,
						CreatedAt: now,
					}); err != nil {
						log.Printf("[epistemic] save evidence %s: %v", evID, err)
					}
				}
			}
		} else {
			log.Printf("[epistemic] parse map_evidence: %v", err)
		}
	}

	// 2. extract_claims → save claims + link to article (with signature dedup)
	if raw, ok := outputs["extract_claims"]; ok {
		var result struct {
			Claims []struct {
				ClaimID string `json:"claim_id"`
				Text    string `json:"text"`
			} `json:"claims"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
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
			runID := storage.EnsureGenerationRunID()
			for _, rc := range result.ResolvedClaims {
				if rc.ClaimID == "" {
					continue
				}
				if err := s.db.SaveClaim(&storage.Claim{
					ID:                rc.ClaimID,
					Text:              rc.Text,
					Status:            rc.Status,
					ConfidenceVector:  rc.ConfidenceVector,
					DerivedConfidence: rc.DerivedConfidence,
					UpdatedAt:         now,
				}); err != nil {
					log.Printf("[epistemic] resolve claim %s: %v", rc.ClaimID, err)
					continue
				}
				if err := s.db.SaveClaimVersion(rc.ClaimID, runID, rc.ConfidenceVector, rc.DerivedConfidence); err != nil {
					log.Printf("[epistemic] save version %s: %v", rc.ClaimID, err)
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
			for _, g := range result.Gaps {
				if g.EvidenceID == "" {
					continue
				}
				if err := s.db.SaveEvidenceGap(&storage.EvidenceGap{
					ID:                 g.EvidenceID,
					GapType:            g.GapType,
					ExpectedArtifact:   g.ExpectedArtifact,
					VerificationStatus: g.VerificationStatus,
					CauseLabel:         g.CauseLabel,
					CauseConfidence:    g.CauseConfidence,
					DetectedAt:         now,
				}); err != nil {
					log.Printf("[epistemic] save gap %s: %v", g.EvidenceID, err)
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
			for _, f := range result.Flags {
				if f.ClaimID == "" {
					continue
				}
				id := f.ClaimID + "-lang-" + storage.EnsureGenerationRunID()
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
				ClaimID    string   `json:"claim_id"`
				RiskFactors []string `json:"risk_factors"`
				RiskScore  float64  `json:"risk_score"`
				Action     struct {
					RequiresExtraCorroboration bool     `json:"requires_extra_corroboration"`
					ExcludedEvidenceIDs       []string `json:"excluded_evidence_ids"`
					MinimumIndependentSources int      `json:"minimum_independent_sources"`
				} `json:"action"`
			} `json:"risk_assessments"`
		}
		b, _ := json.Marshal(raw)
		if err := json.Unmarshal(b, &result); err == nil {
			for _, a := range result.Assessments {
				if a.ClaimID == "" {
					continue
				}
				id := a.ClaimID + "-scr-" + storage.EnsureGenerationRunID()
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
