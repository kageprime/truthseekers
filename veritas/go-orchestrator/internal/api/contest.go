package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
)

// Article contestation (reader challenge → adjudication → conditional regen).
//
// POST /articles/:slug/contest {argument} validates the argument, saves it,
// and runs a short-budget adjudicator over the article's abstract plus its
// resolved claims. A warranted challenge queues a regeneration carrying the
// argument as session context (see Note threading); otherwise the caller
// gets the reasoning and nothing regenerates. Synchronous by design — the
// 25s adjudication budget fits inside the router's response window, and the
// contestation row persists first so a dropped connection is retry-safe.

// adjudicateTimeout bounds the judge call. Small prompt, tiny output —
// typically seconds; the ceiling keeps us clear of the router guillotine.
const adjudicateTimeout = 25 * time.Second

const adjudicateSystem = `You judge whether a reader's challenge to an encyclopedia article warrants regeneration. Be skeptical but fair: the bar is new perspective or new information, not restatement or tone. Answer JSON only: {"verdict": "warrants_regeneration" | "no_change", "reasoning": "one or two sentences", "affected_claim_ids": ["..."]}.`

type adjudicateVerdict struct {
	Verdict         string   `json:"verdict"`
	Reasoning       string   `json:"reasoning"`
	AffectedClaimIDs []string `json:"affected_claim_ids"`
}

func (s *Server) adjudicateContest(articleTitle, abstract string, claims []contestClaim, argument string) (adjudicateVerdict, error) {
	var nilVerdict adjudicateVerdict
	var sb strings.Builder
	sb.WriteString("ARTICLE: " + articleTitle + "\nABSTRACT: " + abstract + "\nRESOLVED CLAIMS:\n")
	for i, c := range claims {
		if i >= 30 {
			fmt.Fprintf(&sb, "... and %d more claims\n", len(claims)-i)
			break
		}
		text := c.Text
		if len(text) > 300 {
			text = text[:300] + "…"
		}
		fmt.Fprintf(&sb, "- [%s] (%s) %s\n", c.ID, c.Status, text)
	}
	sb.WriteString("\nREADER CHALLENGE:\n" + argument + "\n\nReturn JSON only.")
	raw, err := agent.SendPromptJSONBudget(adjudicateSystem, sb.String(), agent.EpistemicModel(), adjudicateTimeout)
	if err != nil {
		return nilVerdict, err
	}
	var v adjudicateVerdict
	if err := json.Unmarshal(raw, &v); err != nil {
		return nilVerdict, fmt.Errorf("parse verdict: %w", err)
	}
	if v.Verdict != "warrants_regeneration" && v.Verdict != "no_change" {
		return nilVerdict, fmt.Errorf("unknown verdict %q", v.Verdict)
	}
	return v, nil
}

type contestClaim struct {
	ID     string
	Text   string
	Status string
}

func (s *Server) handleContestArticle(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "contest article slug=%s", slug)
	userID := userIDFromRequest(r)

	var body struct {
		Argument string `json:"argument"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Invalid JSON body"}`, http.StatusBadRequest)
		return
	}
	argument := strings.TrimSpace(body.Argument)
	if argument == "" {
		http.Error(w, `{"error":"argument required"}`, http.StatusBadRequest)
		return
	}
	if len(argument) > 5000 {
		http.Error(w, `{"error":"argument too long (max 5000)"}`, http.StatusBadRequest)
		return
	}

	article, err := s.db.GetArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if article == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error": "Article not found"}`))
		return
	}

	// Persist first: a dropped connection stays retry-safe as pending.
	contestID := uuidV4()
	if err := s.db.SaveContestation(contestID, slug, userID, argument); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	stored, err := s.db.GetClaimsByArticle(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	claims := make([]contestClaim, 0, len(stored))
	for _, c := range stored {
		claims = append(claims, contestClaim{ID: c.ID, Text: c.Text, Status: c.Status})
	}

	verdict, err := s.adjudicateContest(article.Title, article.Abstract, claims, argument)
	if err != nil {
		log.Printf("⚠️ [contest] slug=%s adjudication failed: %v", slug, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(fmt.Sprintf(`{"status":"undecided","contestation_id":%q,"error":"adjudication unavailable, try again"}`, contestID)))
		return
	}
	if err := s.db.SetContestationVerdict(contestID, verdict.Verdict, verdict.Reasoning); err != nil {
		log.Printf("[contest] verdict persist %s: %v", contestID, err)
	}

	if verdict.Verdict != "warrants_regeneration" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status":           "no_change",
			"reasoning":        verdict.Reasoning,
			"contestation_id":  contestID,
		})
		return
	}

	_, err = s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
		Slug:    slug,
		UserID:  userID,
		Persona: "veritas",
		Source:  "contest",
		Note:    argument,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(fmt.Sprintf(`{"status":"busy","slug":"%s","contestation_id":%q,"error":"%s"}`, slug, contestID, err.Error())))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(fmt.Sprintf(`{"status":"queued","slug":"%s","contestation_id":%q}`, slug, contestID)))
}
