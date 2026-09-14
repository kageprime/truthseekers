package agent

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// RewriteArticleWithFindings re-invokes the generate_article prompt once with
// lint findings appended (same arming pattern as contestNote). The caller
// passes the DAG inputs for resolve/retrieve/extract_claims. Returns the new
// parsed output or an error; callers keep the original on failure.
func RewriteArticleWithFindings(systemPrompt, contestNote string, resolveOut, retrieveOut, claimsOut interface{}, findings []string) (interface{}, error) {
	prompt := promptGenerateArticle
	if contestNote != "" {
		prompt += "\n\n" + contestedPerspective + "\n\"" + contestNote + "\""
	}
	parts := []string{"LINT FINDINGS (fix every item below, keep all [claim:] anchors intact):\n" + strings.Join(findings, "\n")}
	for label, val := range map[string]interface{}{"RESOLVED CLAIMS": resolveOut, "RESEARCH DOCUMENTS": retrieveOut, "CLAIMS": claimsOut} {
		b, _ := json.MarshalIndent(val, "", "  ")
		parts = append(parts, fmt.Sprintf("%s:\n%s", label, string(b)))
	}
	userPrompt := prompt + "\n\n" + strings.Join(parts, "\n\n") + "\n\nReturn JSON only."
	result, err := SendPromptJSON(systemPrompt, userPrompt, epistemicModel)
	if err != nil {
		return nil, err
	}
	var output interface{}
	if err := json.Unmarshal(result, &output); err != nil {
		return nil, err
	}
	return output, nil
}

// verifySampleResult is one sampled citation check (log-first, no schema).
type verifySampleResult struct {
	ClaimID   string
	Supported bool
	Conf      float64
	Note      string
}

// SampleVerifyWeakClaims checks up to 5 weak/disputed/low-confidence claims
// against their first evidence URL using the same verdict prompt as the
// verify_citation tool. Returns human-readable lines for logging; callers may
// downgrade confidence or append to the confidence note.
func SampleVerifyWeakClaims(resolveOut, retrieveOut interface{}) []verifySampleResult {
	urls := map[string]string{}
	if b, err := json.Marshal(retrieveOut); err == nil {
		var r struct {
			Documents map[string][]struct {
				ID  string `json:"id"`
				URL string `json:"url"`
			} `json:"documents"`
		}
		if json.Unmarshal(b, &r) == nil {
			for _, docs := range r.Documents {
				for _, d := range docs {
					if d.ID != "" && d.URL != "" {
						urls[d.ID] = d.URL
					}
				}
			}
		}
	}
	type rc struct {
		ClaimID           string   `json:"claim_id"`
		Text              string   `json:"text"`
		Status            string   `json:"status"`
		DerivedConfidence float64  `json:"derived_confidence"`
		EvidenceIDs       []string `json:"evidence_ids"`
	}
	b, err := json.Marshal(resolveOut)
	if err != nil {
		return nil
	}
	var parsed struct {
		ResolvedClaims []rc `json:"resolved_claims"`
	}
	if json.Unmarshal(b, &parsed) != nil {
		return nil
	}
	var targets []rc
	for _, c := range parsed.ResolvedClaims {
		if c.ClaimID == "" || c.Text == "" {
			continue
		}
		if c.Status == "weak" || c.Status == "disputed" || c.DerivedConfidence < 0.5 {
			targets = append(targets, c)
			if len(targets) >= 5 {
				break
			}
		}
	}
	var out []verifySampleResult
	for _, t := range targets {
		src := ""
		for _, eid := range t.EvidenceIDs {
			if u, ok := urls[eid]; ok {
				src = u
				break
			}
		}
		if src == "" {
			for _, u := range urls {
				src = u
				break
			}
		}
		if src == "" {
			continue
		}
		text, err := fetchSafeText(src, 6000)
		if err != nil || text == "" {
			out = append(out, verifySampleResult{ClaimID: t.ClaimID, Note: "fetch failed"})
			continue
		}
		sys := "You are a fact-checking AI. Given a claim and source text, determine if the source supports the claim. Respond with JSON only: { supported: boolean, confidence: number (0-1), explanation: string }"
		res, err := SendPromptJSON(sys, fmt.Sprintf("Claim: \"%s\"\n\nSource text:\n%s", t.Text, text), epistemicModel)
		if err != nil {
			log.Printf("[verify-sample] claim %s: LLM call failed: %v", t.ClaimID, err)
			continue
		}
		var v struct {
			Supported   bool    `json:"supported"`
			Confidence  float64 `json:"confidence"`
			Explanation string  `json:"explanation"`
		}
		if json.Unmarshal(res, &v) != nil {
			continue
		}
		out = append(out, verifySampleResult{ClaimID: t.ClaimID, Supported: v.Supported, Conf: v.Confidence, Note: v.Explanation})
	}
	return out
}
