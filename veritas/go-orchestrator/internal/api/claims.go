package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// ────────────────────────────────────────────────────────────
// Claim Finder — internet mode
// The finder is no longer corpus-only: POST /claims/verify takes any statement,
// searches our corpus, and adjudicates the statement against live web evidence.
// ────────────────────────────────────────────────────────────

// dossierTTL bounds how long a cached open-web verdict is served before the
// finder re-runs retrieval. Evidence decays; a day-old dossier is a lead, not
// a ruling.
const dossierTTL = 24 * time.Hour

type verifyClaimReq struct {
	Statement string `json:"statement"`
	// Refresh forces a fresh retrieval + adjudication, ignoring the cache.
	Refresh bool `json:"refresh"`
}

func writeClaimsJSON(w http.ResponseWriter, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payload)
}

// handleVerifyClaim backs the finder's "search the whole internet" mode:
//
//	POST /claims/verify {"statement": "...", "refresh": false}
//	→ {"statement", "corpus": {claims: []}, "dossier": {...}|null, "cached", "note"?}
//
// Verification failure is never fatal: the corpus half always answers, and the
// note explains why the open-web half is missing.
func (s *Server) handleVerifyClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, http.StatusMethodNotAllowed)
		return
	}
	var body verifyClaimReq
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}
	statement := strings.TrimSpace(body.Statement)
	if len(statement) < 8 {
		http.Error(w, `{"error":"statement must be at least 8 characters"}`, http.StatusBadRequest)
		return
	}
	if len(statement) > agent.MaxClaimStatementChars {
		statement = statement[:agent.MaxClaimStatementChars]
	}
	reqLog(r, "verify claim len=%d refresh=%v", len(statement), body.Refresh)

	// Corpus half first — cheap, always available, and it answers even when the
	// LLM or the retrieval keys are down.
	corpus := []*storage.ClaimWithArticle{}
	if claims, err := s.db.SearchClaims(statement, 6); err != nil {
		log.Printf("[claims] corpus search failed: %v", err)
	} else if claims != nil {
		corpus = claims
	}

	hash := storage.ClaimStatementHash(statement)

	// Serve a fresh cached dossier unless the caller asked to re-verify.
	if !body.Refresh {
		if payload, updatedAt, err := s.db.GetClaimDossier(hash); err == nil && len(payload) > 0 && time.Since(updatedAt) < dossierTTL {
			var dossier map[string]interface{}
			if json.Unmarshal(payload, &dossier) == nil {
				writeClaimsJSON(w, map[string]interface{}{
					"statement": statement,
					"corpus":    map[string]interface{}{"claims": corpus},
					"dossier":   dossier,
					"cached":    true,
					"note":      "Served from the dossier cache — pass refresh:true to re-verify against the live web.",
				})
				return
			}
		}
	}

	dossier, err := agent.VerifyStatementOnline(statement)
	if err != nil {
		log.Printf("[claims] open-web verification failed: %v", err)
		writeClaimsJSON(w, map[string]interface{}{
			"statement": statement,
			"corpus":    map[string]interface{}{"claims": corpus},
			"dossier":   nil,
			"cached":    false,
			"note": "Open-web verification is unavailable right now (" + err.Error() +
				"). Corpus findings below are unaffected — retry when the adjudicator is reachable.",
		})
		return
	}

	if payload, err := json.Marshal(dossier); err == nil {
		if err := s.db.SaveClaimDossier(hash, statement, dossier.Verdict, dossier.Confidence, dossier.Grounded, dossier.SourcesReviewed, payload); err != nil {
			log.Printf("[claims] save dossier: %v", err)
		}
	}

	writeClaimsJSON(w, map[string]interface{}{
		"statement": statement,
		"corpus":    map[string]interface{}{"claims": corpus},
		"dossier":   dossier,
		"cached":    false,
	})
}

// handleRecentClaimDossiers serves GET /claims/recent?limit= — the most recent
// open-web verdicts, so the finder's idle state shows the tool in use.
func (s *Server) handleRecentClaimDossiers(w http.ResponseWriter, r *http.Request) {
	limit := 8
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 25 {
		limit = l
	}
	reqLog(r, "recent claim dossiers limit=%d", limit)
	dossiers, err := s.db.RecentClaimDossiers(limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if dossiers == nil {
		dossiers = []map[string]interface{}{}
	}
	cache60(w)
	writeClaimsJSON(w, map[string]interface{}{"dossiers": dossiers})
}
