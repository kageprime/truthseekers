package agent

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// ────────────────────────────────────────────────────────────
// Open-web claim adjudication — the engine behind POST /claims/verify
// ────────────────────────────────────────────────────────────

// WebClaimSource is one cited document inside an open-web dossier. Citations
// are filtered against the documents the retriever actually fetched: a URL the
// model invented is dropped rather than surfaced as provenance.
type WebClaimSource struct {
	Title  string `json:"title"`
	URL    string `json:"url"`
	Quote  string `json:"quote,omitempty"`
	Stance string `json:"stance,omitempty"` // supports | contradicts | contextual
	Source string `json:"source,omitempty"` // host, for the UI's source badge
}

// ClaimDossier is the verdict for an arbitrary statement checked against live
// web evidence. Verdict is one of: supported | contested | weak | unverified.
// Grounded is false when retrieval was unavailable — callers must label such
// dossiers as model-only, never as sourced.
type ClaimDossier struct {
	Statement       string           `json:"statement"`
	Verdict         string           `json:"verdict"`
	Confidence      float64          `json:"confidence"`
	Rationale       string           `json:"rationale"`
	Supporting      []WebClaimSource `json:"supporting"`
	Contradicting   []WebClaimSource `json:"contradicting"`
	Context         []WebClaimSource `json:"context"`
	Caveats         []string         `json:"caveats"`
	Grounded        bool             `json:"grounded"`
	SourcesReviewed int              `json:"sources_reviewed"`
	Model           string           `json:"model"`
	CheckedAt       time.Time        `json:"checked_at"`
}

const (
	// claimDossierTimeout bounds the whole check (retrieval + adjudication) so
	// the HTTP handler answers with a degradation note instead of hanging.
	claimDossierTimeout = 120 * time.Second
	// claimDossierDocs / claimDossierDocText bound the adjudicator prompt: a
	// "search of claims" query can surface hundreds of thousands of characters
	// of scraped text, and the model only needs the top slice of each source.
	claimDossierDocs    = 14
	claimDossierDocText = 1800
	claimSourceQuoteCap = 320
	// MaxClaimStatementChars bounds stored + hashed statements.
	MaxClaimStatementChars = 600
)

// claimDossierSystem is the adjudicator persona: verdict + provenance only.
const claimDossierSystem = `You are VERITAS Claim Adjudicator, the verification engine of an evidence-grounded encyclopedia.

TASK: Judge whether the STATEMENT UNDER TEST is supported by the RETRIEVED DOCUMENTS, and return a structured dossier.

RULES:
1. The retrieved documents are the ONLY admissible evidence. Never cite a URL, title, or fact that is not present in them.
2. Verdicts: "supported" (multiple independent sources agree), "contested" (credible sources disagree), "weak" (thin, indirect, or single-source support), "unverified" (documents do not address the statement).
3. Confidence is your calibrated probability (0.0-1.0) that the verdict is correct given the evidence.
4. Prefer primary sources, peer-reviewed work, and institutional records over aggregators, blogs, and content farms. Say so in the caveats when the evidence base is weak.
5. Quotes must be verbatim spans from the cited document, 40 words or fewer.
6. Be adversarial toward the statement: actively look for contradicting evidence and list it. If none exists in the documents, return an empty contradicting array — do not invent a counterpoint.
7. Record the limits of what was retrieved in "caveats": missing primary sources, recency, disputed measurement, etc.

Return JSON ONLY, shaped exactly:
{
  "verdict": "supported | contested | weak | unverified",
  "confidence": 0.0,
  "rationale": "2-4 sentences citing source numbers like [1], [3]",
  "supporting": [{"title": "...", "url": "...", "quote": "...", "stance": "supports"}],
  "contradicting": [{"title": "...", "url": "...", "quote": "...", "stance": "contradicts"}],
  "context": [{"title": "...", "url": "...", "quote": "...", "stance": "contextual"}],
  "caveats": ["..."]
}`

// VerifyStatementOnline retrieves live web evidence for an arbitrary statement
// and adjudicates it into a ClaimDossier. It powers the Claim Finder's
// internet-wide mode, so it works on statements that are nowhere in our corpus.
//
// Retrieval failure is not fatal: the adjudicator still runs, the dossier comes
// back with Grounded=false, and a caveat marks it as model-only. Only an
// unusable LLM response returns an error (the handler then degrades to
// corpus-only results).
func VerifyStatementOnline(statement string) (*ClaimDossier, error) {
	statement = strings.TrimSpace(statement)
	if statement == "" {
		return nil, fmt.Errorf("statement required")
	}
	if len(statement) > MaxClaimStatementChars {
		statement = statement[:MaxClaimStatementChars]
	}

	retrieve := RealRetrieve
	if retrieve == nil {
		retrieve = RealRetrieveDocuments
	}

	// Retrieval is not context-aware, so bound it with a select race. The
	// result channel is buffered, so the goroutine exits cleanly on timeout.
	type retrieveResult struct {
		docs []RetrievedDoc
		err  error
	}
	retrieved := make(chan retrieveResult, 1)
	go func() {
		docs, err := retrieve(statement)
		retrieved <- retrieveResult{docs: docs, err: err}
	}()

	var docs []RetrievedDoc
	var retrievalErr error
	select {
	case r := <-retrieved:
		docs, retrievalErr = r.docs, r.err
	case <-time.After(claimDossierTimeout):
		retrievalErr = fmt.Errorf("retrieval timed out after %s", claimDossierTimeout)
	}

	if len(docs) > claimDossierDocs {
		docs = docs[:claimDossierDocs]
	}

	// Build the admissible-evidence digest and the URL allow-list in one pass:
	// whatever is not in this map can never come back as a citation.
	type digestDoc struct {
		N     int    `json:"n"`
		Title string `json:"title"`
		URL   string `json:"url"`
		Text  string `json:"text"`
	}
	digest := make([]digestDoc, 0, len(docs))
	allowed := map[string]string{} // canonical citation key → canonical URL
	for _, d := range docs {
		if d.URL == "" {
			continue
		}
		text := d.Text
		if strings.TrimSpace(text) == "" {
			text = d.Snippet
		}
		text = strings.Join(strings.Fields(text), " ")
		if len(text) > claimDossierDocText {
			text = text[:claimDossierDocText] + "…"
		}
		if key := citeKey(d.URL); key != "" {
			allowed[key] = d.URL
		}
		digest = append(digest, digestDoc{N: len(digest) + 1, Title: d.Title, URL: d.URL, Text: text})
	}
	grounded := len(digest) > 0
	docJSON, _ := json.MarshalIndent(digest, "", "  ")

	var sb strings.Builder
	sb.WriteString("STATEMENT UNDER TEST:\n")
	sb.WriteString(statement)
	sb.WriteString("\n\n")
	if grounded {
		sb.WriteString("RETRIEVED DOCUMENTS (the only admissible evidence; cite them by url):\n")
		sb.Write(docJSON)
	} else {
		sb.WriteString("RETRIEVED DOCUMENTS: none available — live retrieval is offline in this deployment.\n")
		sb.WriteString("Judge from your own knowledge, lower confidence accordingly, return EMPTY supporting/contradicting/context arrays, and state in the caveats that no live sources were retrieved.\n")
	}
	sb.WriteString("\n\nReturn JSON only.")

	raw, err := SendPromptJSONBudget(claimDossierSystem, sb.String(), EpistemicModel(), claimDossierTimeout)
	if err != nil {
		return nil, fmt.Errorf("adjudicator: %w", err)
	}

	var parsed struct {
		Verdict       string           `json:"verdict"`
		Confidence    float64          `json:"confidence"`
		Rationale     string           `json:"rationale"`
		Supporting    []WebClaimSource `json:"supporting"`
		Contradicting []WebClaimSource `json:"contradicting"`
		Context       []WebClaimSource `json:"context"`
		Caveats       []string         `json:"caveats"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("decode dossier: %w", err)
	}

	dossier := &ClaimDossier{
		Statement:       statement,
		Verdict:         normalizeClaimVerdict(parsed.Verdict),
		Confidence:      clamp01(parsed.Confidence),
		Rationale:       strings.TrimSpace(parsed.Rationale),
		Supporting:      admitCitations(parsed.Supporting, allowed, "supports"),
		Contradicting:   admitCitations(parsed.Contradicting, allowed, "contradicts"),
		Context:         admitCitations(parsed.Context, allowed, "contextual"),
		Caveats:         cleanCaveats(parsed.Caveats),
		Grounded:        grounded,
		SourcesReviewed: len(digest),
		Model:           EpistemicModel(),
		CheckedAt:       time.Now().UTC(),
	}

	if !grounded {
		dossier.Caveats = append(dossier.Caveats,
			"Live web retrieval was unavailable — this verdict is model-only and must not be presented as sourced evidence.")
		if retrievalErr != nil {
			dossier.Caveats = append(dossier.Caveats, "Retrieval detail: "+retrievalErr.Error())
		}
	} else if len(dossier.Supporting) == 0 && len(dossier.Contradicting) == 0 {
		dossier.Caveats = append(dossier.Caveats,
			"The adjudicator cited no retrieved document — treat this verdict as provisional.")
	}
	return dossier, nil
}

// normalizeClaimVerdict collapses free-text verdicts onto the four states the
// UI and the dossier cache understand. Order matters: "weak support" must read
// as weak, and "not supported" must never read as supported.
func normalizeClaimVerdict(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	v = strings.Join(strings.Fields(v), " ")
	switch {
	case v == "":
		return "unverified"
	case strings.HasPrefix(v, "uncontest"), strings.HasPrefix(v, "undisput"):
		return "supported"
	case strings.Contains(v, "contest"), strings.Contains(v, "disput"), strings.Contains(v, "contradict"):
		return "contested"
	case strings.Contains(v, "unsupport"), strings.Contains(v, "not support"), strings.Contains(v, "no support"),
		strings.Contains(v, "weak"), strings.Contains(v, "partial"), strings.Contains(v, "mixed"):
		return "weak"
	case strings.Contains(v, "unverif"), strings.Contains(v, "unknown"), strings.Contains(v, "insufficient"),
		strings.Contains(v, "no evidence"):
		return "unverified"
	case strings.Contains(v, "support"):
		return "supported"
	}
	return "unverified"
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

// citeKey reduces a URL to host+path so a model that appends a query string,
// drops the scheme, or toggles a trailing slash still resolves to the document
// we actually fetched.
func citeKey(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.ToLower(strings.TrimPrefix(u.Host, "www."))
	path := strings.TrimSuffix(u.EscapedPath(), "/")
	return host + path
}

// admitCitations drops any citation that does not match a retrieved document
// and rewrites surviving citations to the canonical fetched URL. This is the
// anti-hallucination guard: the model can only ever show provenance we hold.
func admitCitations(sources []WebClaimSource, allowed map[string]string, stance string) []WebClaimSource {
	out := []WebClaimSource{}
	for _, s := range sources {
		canonical, ok := allowed[citeKey(s.URL)]
		if !ok {
			continue
		}
		quote := strings.Join(strings.Fields(s.Quote), " ")
		if len(quote) > claimSourceQuoteCap {
			quote = quote[:claimSourceQuoteCap] + "…"
		}
		title := strings.TrimSpace(s.Title)
		if title == "" {
			title = canonical
		}
		out = append(out, WebClaimSource{
			Title:  title,
			URL:    canonical,
			Quote:  quote,
			Stance: stance,
			Source: citeHost(canonical),
		})
		if len(out) >= 8 {
			break
		}
	}
	return out
}

func citeHost(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return strings.ToLower(strings.TrimPrefix(u.Host, "www."))
}

// cleanCaveats trims, drops blanks, and caps the list so a chatty model cannot
// dominate the dossier with caveats.
func cleanCaveats(in []string) []string {
	out := []string{}
	for _, c := range in {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if len(c) > 300 {
			c = c[:300] + "…"
		}
		out = append(out, c)
		if len(out) >= 6 {
			break
		}
	}
	return out
}
