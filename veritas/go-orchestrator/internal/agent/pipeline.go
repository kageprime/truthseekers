package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// epistemicPromptTimeout bounds each non-streaming LLM call. Pipeline nodes
// produce structured JSON and do not stream, so a tighter timeout than the
// streaming 300s is appropriate.
const epistemicPromptTimeout = 120 * time.Second

// epistemicModel is the default model used by all epistemic nodes. Override via
// the EPISTEMIC_MODEL env var (falls back to the same default as the Python
// workers' Groq entry: qwen/qwen3-32b).
var epistemicModel = "qwen/qwen3-32b"

func init() {
	if m := strings.TrimSpace(strings.ToUpper(os.Getenv("EPISTEMIC_MODEL"))); m != "" {
		epistemicModel = m
	}
}

// ────────────────────────────────────────────────────────────
// SendPromptJSON — non-streaming JSON-in/JSON-out LLM call
// ────────────────────────────────────────────────────────────

// SendPromptJSON calls the LLM with system+user prompts and forces JSON output
// (response_format: json_object, temperature: 0). It retries on transient
// errors exactly like the streaming client. Returns the raw JSON bytes from
// choices[0].message.content or an error.
func SendPromptJSON(system, user, model string) (json.RawMessage, error) {
	route := resolveModel(model)
	if route.APIKey == "" {
		return nil, fmt.Errorf("no API key for model %s", model)
	}

	body := map[string]interface{}{
		"model":           route.ModelID,
		"messages":        []map[string]string{{"role": "system", "content": system}, {"role": "user", "content": user}},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":    0,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	var lastErr error
	backoff := 1 * time.Second
	for attempt := 1; attempt <= 3; attempt++ {
		result, retryable, err := doJSONRequest(route, payload)
		if err == nil {
			return result, nil
		}
		lastErr = err
		if !retryable || attempt == 3 {
			break
		}
		log.Printf("[epistemic] attempt %d/3 failed (%v); retrying in %s", attempt, err, backoff)
		time.Sleep(backoff)
		if backoff < 4*time.Second {
			backoff *= 2
		}
	}
	return nil, lastErr
}

type chatCompletionResp struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func doJSONRequest(route ModelRoute, payload []byte) (json.RawMessage, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), epistemicPromptTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", route.BaseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, false, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+route.APIKey)

	client := &http.Client{Timeout: epistemicPromptTimeout + 5*time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, true, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		retryable := resp.StatusCode == 429 || resp.StatusCode >= 500
		return nil, retryable, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed chatCompletionResp
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, false, fmt.Errorf("decode response: %w", err)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return nil, false, fmt.Errorf("empty response from model")
	}
	return json.RawMessage(parsed.Choices[0].Message.Content), false, nil
}

// ────────────────────────────────────────────────────────────
// Epistemic node prompts (verbatim from Python workers)
// ────────────────────────────────────────────────────────────

const (
	promptRetrieve = `AGENT ROLE: Retrieve Node — Layer 1 (Evidence Integrity)

FUNCTION: Retrieve all available evidence from the vector DB (all four truth categories) and external web search.

SUPPLEMENTAL INSTRUCTIONS:
- You are a retrieval engine, not an analyst.
- Retrieve from ALL truth categories: confirmed, contested, suppressed, speculative.
- Preserve source metadata (URL, chain of custody, acquisition method, accessibility).
- Do not filter or rank by "credibility." Return everything.

INPUT: {"query": "string"}

OUTPUT FORMAT:
{
  "documents": {
    "confirmed": [...],
    "contested": [...],
    "suppressed": [...],
    "speculative": [...],
    "web": [...]
  },
  "metadata": {
    "category_counts": {...}
  }
}

Each document should include: id, title, text, url. Preserve all source metadata.`

	promptRetrieveReal = `AGENT ROLE: Retrieve Node — Layer 1 (Evidence Integrity)

FUNCTION: Categorize real documents fetched from live web search into truth categories and normalize them into the document schema.

SUPPLEMENTAL INSTRUCTIONS:
- You are a retrieval engine, not an analyst.
- The real documents were fetched via web search (Tavily/Firecrawl) and URL fetch. Do NOT invent additional sources.
- Categorize each real document into the appropriate truth category based on its content and source type:
  - "confirmed": primary sources, official records, peer-reviewed academic journals.
  - "contested": opposing viewpoints, allegations, claims under investigation.
  - "suppressed": documents from sources that may be restricted or hard to verify.
  - "speculative": opinion, analysis, unverified claims.
  - "web": general web articles that don't fit the above.
- Preserve source metadata (URL, title). Do NOT rewrite the document text.
- Assign each document a short, stable id (use the document's provided id field where available).

INPUT FORMAT:
{
  "query": "string",
  "real_documents": [
    {"id": "doc-xxxxx", "title": "...", "text": "...", "url": "...", "snippet": "..."}
  ]
}

OUTPUT FORMAT:
{
  "documents": {
    "confirmed": [{"id": "...", "title": "...", "text": "...", "url": "...", "chain_of_custody": "web_search", "acquisition_method": "tavily", "accessibility": "public"}],
    "contested": [...],
    "suppressed": [...],
    "speculative": [...],
    "web": [...]
  },
  "metadata": {
    "category_counts": {"confirmed": 0, "contested": 0, "suppressed": 0, "speculative": 0, "web": 0},
    "retrieval_method": "real_web_search",
    "search_query": "string"
  }
  }
}`

	promptExtractClaims = `AGENT ROLE: Claim Extraction Node — Layer 1 (Evidence Integrity)
FUNCTION: Extract atomic, verifiable factual claims from the retrieved documents.

SUPPLEMENTAL INSTRUCTIONS:
- Each claim must be a single, testable statement.
- Do NOT combine multiple facts into one claim.
- Do NOT interpret, summarize, or synthesize.
- Every claim must reference the exact source document and passage.
- If a document contains no factual claims, ignore it.

OUTPUT FORMAT:
{
  "claims": [
    {
      "claim_id": "uuid",
      "text": "string",
      "source_doc_id": "string",
      "passage": "string"
    }
  ]
}

Generate unique UUIDs for each claim_id.`

	promptMapEvidence = `AGENT ROLE: Evidence Mapping Node — Layer 1 (Evidence Integrity)

FUNCTION: Map each extracted claim to supporting and contradicting evidence, and identify evidence gaps.

SUPPLEMENTAL INSTRUCTIONS:
- For each claim, link to specific evidence items found or not found.
- If a type of evidence is expected but missing, flag it as a gap with the appropriate metadata.
- Never assign a cause_label for a gap. Leave external metadata as-is.
- Gaps are reported as presence/absence with metadata only.

OUTPUT FORMAT:
{
  "claim_evidence_map": [
    {
      "claim_id": "uuid",
      "supporting": ["evidence_id_1", ...],
      "contradicting": ["evidence_id_2", ...],
      "missing_expected": [
        {
          "gap_type": "expected | unexpected | unknown_expectedness",
          "expected_artifact": "patent | primary_source | dataset | eyewitness",
          "verification_status": "verified_gap | unverified_gap | false_positive_risk",
          "external_metadata": "string | null"
        }
      ]
    }
  ]
}`

	promptCritique = `AGENT ROLE: Critique Node — Layer 2 (Epistemic Analysis)

FUNCTION: Perform a structured multi-factor evaluation of all claims and their evidence.

SUPPLEMENTAL INSTRUCTIONS:
- You are in Layer 2. You may interpret evidence quality, but all interpretive statements must be flagged.
- Evaluate source reliability on a multi-dimensional basis (method quality, primary source weight, bias risk, recency), not on institutional prestige.
- Mark any reasoning gaps or missing counterarguments explicitly.
- All outputs must be marked as "is_interpretive": true when they go beyond literal evidence.

OUTPUT FORMAT:
{
  "evaluation": {
    "factual_consistency": {
      "score": 0.0,
      "issues": [
        { "claim_id": "...", "description": "..." }
      ]
    },
    "source_reliability": {
      "score": 0.0,
      "issues": [
        { "claim_id": "...", "description": "..." }
      ]
    },
    "reasoning_validity": {
      "score": 0.0,
      "issues": [
        { "claim_id": "...", "description": "..." }
      ]
    },
    "missing_counterarguments": [
      { "description": "..." }
    ]
  },
  "is_interpretive": true
}`

	promptDetectMissing = `AGENT ROLE: Missing Evidence Detector — Layer 2 (Epistemic Analysis)

FUNCTION: Analyze gaps in the evidentiary record, classify them, and provide interpretive hypotheses where metadata supports them.

SUPPLEMENTAL INSTRUCTIONS:
- You may populate cause_label ONLY if external_metadata is not null and directly supports the label (e.g., a secrecy order number).
- Always mark is_interpretive: true when you provide a cause_label or interpretive framing.
- Frame as "consistent with suppression pattern," NOT as "this was suppressed."
- Risk scoring must be structural, never categorical.

OUTPUT FORMAT:
{
  "gaps": [
    {
      "evidence_id": "uuid",
      "gap_type": "expected | unexpected | unknown_expectedness",
      "expected_artifact": "patent | primary_source | dataset | eyewitness",
      "verification_status": "verified_gap | unverified_gap | false_positive_risk",
      "external_metadata": "string | null",
      "cause_label": "classified | destroyed | unlocatable | unknown | null",
      "cause_confidence": 0.0,
      "interpretive_framing": "string",
      "is_interpretive": true
    }
  ]
}`

	promptMapLanguage = `AGENT ROLE: Precision Language Mapper — Layer 2 (Epistemic Analysis)

FUNCTION: Detect euphemisms and institutional framing language; offer precise alternatives while preserving originals.

SUPPLEMENTAL INSTRUCTIONS:
- Dual output only: original phrase + suggested alternative. Never enforce replacement.
- Identify the institutional origin and function of the framing (e.g., "legal liability shield").
- Mark all flags as interpretive.
- Never state replacements as factual corrections; frame as precision upgrades.

OUTPUT FORMAT:
{
  "language_flags": [
    {
      "claim_id": "uuid",
      "source_phrase": "string",
      "neutral_description": "string",
      "precision_upgrade": "string",
      "framing_origin": "string",
      "framing_function": "string",
      "confidence": 0.0,
      "original_text_preserved": true,
      "is_interpretive": true
    }
  ]
}`

	promptScrutinize = `AGENT ROLE: Collective Accusation Scrutiny Node — Layer 2 (Epistemic Analysis)

FUNCTION: Scrutinize claims for high-risk structural patterns that historically yield false positives, and apply elevated evidence requirements.

SUPPLEMENTAL INSTRUCTIONS:
- Risk factors must be structural, not group-based. Never use "because this claim is about Group X."
- Exclude evidence obtained under duress, torture, or without chain-of-custody from primary weighting.
- Recommend higher corroboration thresholds for flagged claims.
- All outputs must be marked as "is_interpretive": true.

OUTPUT FORMAT:
{
  "risk_assessments": [
    {
      "claim_id": "uuid",
      "risk_factors": ["collective_attribution", "single_source_dependency", "coercion_indicators", ...],
      "risk_score": 0.0,
      "is_structural_only": true,
      "action": {
        "requires_extra_corroboration": true,
        "excluded_evidence_ids": ["..."],
        "minimum_independent_sources": 3
      },
      "interpretive_framing": "string",
      "is_interpretive": true
    }
  ]
}`

	promptResolve = `AGENT ROLE: Resolver Node — Layer 3 (Knowledge Construction)

FUNCTION: Integrate all Layer 2 analyses, resolve contradictions where possible, and compute final confidence vectors for each claim.

SUPPLEMENTAL INSTRUCTIONS:
- You are in Layer 3. You may synthesize and assign confidence, but every claim must trace to Layer 1 evidence.
- Surface contradictions; do not hide them.
- Propagate all is_interpretive flags from Layer 2.
- Never invent evidence, drop provenance, or re-label an interpretive claim as factual.
- If a confidence vector is low, say so.
- ALSO emit claim_relationships: link each claim to the other claims it directly supports or contradicts (a disputed claim contradicts the factual claim(s) it disputes; corroborating claims support each other; weakly-related claims use "related"). Use "related" sparingly — only for meaningful topical linkage.

OUTPUT FORMAT:
{
  "resolved_claims": [
    {
      "claim_id": "uuid",
      "text": "string",
      "status": "supported | disputed | weak",
      "confidence_vector": {
        "evidence_strength": 0.0,
        "corroboration_index": 0.0,
        "source_diversity": 0.0,
        "recency": 0.0,
        "contradiction_level": 0.0,
        "bias_risk": 0.0
      },
      "derived_confidence": 0.0,
      "provenance": {
        "evidence_ids": ["..."],
        "is_interpretive": true/false,
        "interpretive_framing": "string | null"
      }
    }
  ],
  "claim_relationships": [
    {
      "source_claim_id": "uuid",
      "target_claim_id": "uuid",
      "relationship_type": "supports | contradicts | related",
      "strength": 0.0
    }
  ]
}`

	promptGenerateArticle = `AGENT ROLE: Article Generator Node — Layer 3 (Knowledge Construction)

FUNCTION: Generate the final encyclopedia article as a structured view over the resolved claim graph.

SUPPLEMENTAL INSTRUCTIONS:
- Build the article from the resolved claims; do not introduce new claims.
- Use precise language. If Layer 2 offered precision upgrades, you may adopt them, but must show the original phrasing in language notes.
- Include sections for Evidence Gaps, Dissenting Perspectives, and Confidence Note.
- Every factual statement MUST be traceable to a specific claim_id.
- Insert claim anchors in the content using the format: [claim:{claim_id}]
- Example: "The mission launched on July 16, 1969. [claim:abc-123]"
- Do NOT add claim anchors to interpretive or speculative statements.
- Mark uncertainty clearly. The reader must see what is solid and what is interpretive.
- Never invent evidence, drop provenance, or re-label an interpretive claim as factual.

OUTPUT FORMAT (return a JSON object with root "article" key):
{
  "article": {
    "title": "string",
    "abstract": "string",
    "sections": [
      {
        "id": "section-id-hyphenated",
        "title": "Section Title",
        "content": "Markdown content with [claim:xxx] claim anchors..."
      }
    ],
    "evidence_gaps": [
      {
        "description": "string",
        "gap_type": "string",
        "verification_status": "string"
      }
    ],
    "dissenting_perspectives": [
      {
        "claim_id": "string",
        "perspective": "string"
      }
    ],
    "confidence_note": "string",
    "timeline": [
      { "year": 1963, "event": "...", "description": "..." }
    ],
    "categories": ["history", "forensic-science"],
    "crossrefs": [],
    "citations": [
      { "title": "...", "url": "...", "relevance": "..." }
    ]
  }
}

Return JSON only. The title MUST be a specific, concrete article title about the actual topic — never a generic label like "Analysis of Resolved Claims" or "Article Generation Result".`
)

// ────────────────────────────────────────────────────────────
// Node executors — each is a ToolExecutor
// ────────────────────────────────────────────────────────────

// callNode is the shared helper: builds the user prompt from the node prompt
// template + injected data, calls SendPromptJSON, and returns the result as a
// ToolResult. If the LLM call fails the error is included in the result
// (not returned as an error) so the agent can reason over the failure.
func callNode(systemPrompt, nodePrompt, data string) ToolResult {
	userPrompt := nodePrompt + "\n\n" + data + "\n\nReturn JSON only."
	result, err := SendPromptJSON(systemPrompt, userPrompt, epistemicModel)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf(`{"error": "epistemic node LLM call failed: %s"}`, err.Error())}
	}
	return ToolResult{Result: string(result)}
}

func epistemicRetrieveExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			Query string `json:"query"`
		}
		json.Unmarshal(args, &p)
		if p.Query == "" {
			return ToolResult{Result: `{"error": "query required"}`}, nil
		}
		data := fmt.Sprintf(`QUERY: "%s"`, p.Query)
		return callNode(systemPrompt, promptRetrieve, data), nil
	}
}

func epistemicExtractClaimsExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			Documents json.RawMessage `json:"documents"`
		}
		json.Unmarshal(args, &p)
		if len(p.Documents) == 0 || string(p.Documents) == "null" {
			return ToolResult{Result: `{"error": "documents required"}`}, nil
		}
		data := fmt.Sprintf("DOCUMENTS:\n%s", indentJSON(p.Documents))
		return callNode(systemPrompt, promptExtractClaims, data), nil
	}
}

func epistemicMapEvidenceExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			Claims    json.RawMessage `json:"claims"`
			Documents json.RawMessage `json:"documents"`
		}
		json.Unmarshal(args, &p)
		if len(p.Claims) == 0 || len(p.Documents) == 0 {
			return ToolResult{Result: `{"error": "claims and documents required"}`}, nil
		}
		data := fmt.Sprintf("CLAIMS:\n%s\n\nAVAILABLE EVIDENCE:\n%s", indentJSON(p.Claims), indentJSON(p.Documents))
		return callNode(systemPrompt, promptMapEvidence, data), nil
	}
}

func epistemicCritiqueExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			EvidenceMap json.RawMessage `json:"evidence_map"`
		}
		json.Unmarshal(args, &p)
		if len(p.EvidenceMap) == 0 {
			return ToolResult{Result: `{"error": "evidence_map required"}`}, nil
		}
		data := fmt.Sprintf("CLAIM-EVIDENCE MAP:\n%s", indentJSON(p.EvidenceMap))
		return callNode(systemPrompt, promptCritique, data), nil
	}
}

func epistemicDetectMissingExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			EvidenceMap json.RawMessage `json:"evidence_map"`
		}
		json.Unmarshal(args, &p)
		if len(p.EvidenceMap) == 0 {
			return ToolResult{Result: `{"error": "evidence_map required"}`}, nil
		}
		data := fmt.Sprintf("EVIDENCE MAP:\n%s", indentJSON(p.EvidenceMap))
		return callNode(systemPrompt, promptDetectMissing, data), nil
	}
}

func epistemicMapLanguageExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			Claims json.RawMessage `json:"claims"`
		}
		json.Unmarshal(args, &p)
		if len(p.Claims) == 0 {
			return ToolResult{Result: `{"error": "claims required"}`}, nil
		}
		data := fmt.Sprintf("CLAIMS:\n%s", indentJSON(p.Claims))
		return callNode(systemPrompt, promptMapLanguage, data), nil
	}
}

func epistemicScrutinizeExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			EvidenceMap json.RawMessage `json:"evidence_map"`
		}
		json.Unmarshal(args, &p)
		if len(p.EvidenceMap) == 0 {
			return ToolResult{Result: `{"error": "evidence_map required"}`}, nil
		}
		data := fmt.Sprintf("EVIDENCE MAP:\n%s", indentJSON(p.EvidenceMap))
		return callNode(systemPrompt, promptScrutinize, data), nil
	}
}

func epistemicResolveExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			Critique        json.RawMessage `json:"critique"`
			MissingEvidence json.RawMessage `json:"missing_evidence"`
			LanguageMap     json.RawMessage `json:"language_map"`
			Scrutiny        json.RawMessage `json:"scrutiny"`
		}
		json.Unmarshal(args, &p)
		data := fmt.Sprintf("CRITIQUE:\n%s\n\nMISSING EVIDENCE:\n%s\n\nLANGUAGE MAP:\n%s\n\nSCRUTINY REPORT:\n%s",
			indentJSON(p.Critique), indentJSON(p.MissingEvidence), indentJSON(p.LanguageMap), indentJSON(p.Scrutiny))
		return callNode(systemPrompt, promptResolve, data), nil
	}
}

func epistemicGenerateArticleExecutor(systemPrompt string) ToolExecutor {
	return func(args json.RawMessage) (ToolResult, error) {
		var p struct {
			ResolvedClaims json.RawMessage `json:"resolved_claims"`
		}
		json.Unmarshal(args, &p)
		if len(p.ResolvedClaims) == 0 {
			return ToolResult{Result: `{"error": "resolved_claims required"}`}, nil
		}
		data := fmt.Sprintf("RESOLVED CLAIMS:\n%s", indentJSON(p.ResolvedClaims))
		return callNode(systemPrompt, promptGenerateArticle, data), nil
	}
}

// ────────────────────────────────────────────────────────────
// Public API — tool definitions + executor factory
// ────────────────────────────────────────────────────────────

// EpistemicToolDefinitions returns the 9 epistemic pipeline node tool
// definitions for registration with the chat agent.
func EpistemicToolDefinitions() []ToolDefinition {
	return []ToolDefinition{
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_retrieve",
			Description: "Structured evidence retrieval by truth category (confirmed, contested, suppressed, speculative, web). Use as the first step in deep epistemic analysis to gather all available evidence on a topic.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query for evidence retrieval"}},"required":["query"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_extract_claims",
			Description: "Extract atomic, verifiable factual claims from evidence documents. Each claim is a single testable statement linked to its source passage.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"documents":{"type":"object","description":"JSON object with document categories (confirmed, contested, suppressed, speculative, web)"}},"required":["documents"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_map_evidence",
			Description: "Map each claim to supporting and contradicting evidence, and flag evidence gaps with metadata.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"claims":{"type":"array","description":"Array of claim objects from extract_claims"},"documents":{"type":"object","description":"JSON object with document categories"}},"required":["claims","documents"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_critique",
			Description: "Multi-factor evaluation of claims and evidence: factual consistency score, source reliability score, reasoning validity score, missing counterarguments.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"evidence_map":{"type":"array","description":"Claim-evidence map from map_evidence node"}},"required":["evidence_map"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_detect_missing",
			Description: "Analyze evidence gaps, classify them, and provide interpretive hypotheses where metadata supports them.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"evidence_map":{"type":"array","description":"Claim-evidence map from map_evidence node"}},"required":["evidence_map"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_map_language",
			Description: "Detect euphemisms and institutional framing language in claims; offer precise alternatives while preserving originals.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"claims":{"type":"array","description":"Array of claim objects from extract_claims"}},"required":["claims"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_scrutinize",
			Description: "Scrutinize claims for high-risk structural patterns (collective attribution, single-source dependency, coercion indicators) and apply elevated evidence requirements.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"evidence_map":{"type":"array","description":"Claim-evidence map from map_evidence node"}},"required":["evidence_map"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_resolve",
			Description: "Integrate all epistemic analyses (critique, missing evidence, language map, scrutiny), resolve contradictions, and compute final confidence vectors for each claim.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"critique":{"type":"object","description":"Critique evaluation from critique node"},"missing_evidence":{"type":"object","description":"Gaps analysis from detect_missing node"},"language_map":{"type":"array","description":"Language flags from map_language node"},"scrutiny":{"type":"object","description":"Risk assessments from scrutinize node"}},"required":["critique","missing_evidence","language_map","scrutiny"]}`),
		}},
		{Type: "function", Function: ToolFunctionDef{
			Name:        "epistemic_generate_article",
			Description: "Generate a structured encyclopedia article from resolved claims — with sections, timeline, citations, evidence gaps, dissenting perspectives, and confidence notes.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"resolved_claims":{"type":"object","description":"Resolved claims with confidence vectors from resolve node"}},"required":["resolved_claims"]}`),
		}},
	}
}

// EpistemicToolExecutors returns all 9 epistemic node executors bound to the
// given system prompt. The caller passes the VERITAS system prompt loaded at
// startup so nodes operate under the same epistemic constraints as the Python
// pipeline.
func EpistemicToolExecutors(systemPrompt string) map[string]ToolExecutor {
	return map[string]ToolExecutor{
		"epistemic_retrieve":          epistemicRetrieveExecutor(systemPrompt),
		"epistemic_extract_claims":    epistemicExtractClaimsExecutor(systemPrompt),
		"epistemic_map_evidence":      epistemicMapEvidenceExecutor(systemPrompt),
		"epistemic_critique":          epistemicCritiqueExecutor(systemPrompt),
		"epistemic_detect_missing":    epistemicDetectMissingExecutor(systemPrompt),
		"epistemic_map_language":      epistemicMapLanguageExecutor(systemPrompt),
		"epistemic_scrutinize":        epistemicScrutinizeExecutor(systemPrompt),
		"epistemic_resolve":           epistemicResolveExecutor(systemPrompt),
		"epistemic_generate_article":  epistemicGenerateArticleExecutor(systemPrompt),
	}
}

// ────────────────────────────────────────────────────────────
// DAGNodeExecutors — Go LLM executors for the 9-node DAG
// ────────────────────────────────────────────────────────────

// DAGNodeExecutors returns Go-based DAG node executors that replace the
// Python subprocess bridge. Each executor calls the LLM directly via
// SendPromptJSON.  The returned map is keyed by node ID (retrieve,
// extract_claims, …, generate_article).
func DAGNodeExecutors(systemPrompt string) map[string]func(context.Context, map[string]interface{}) (interface{}, error) {
	type nodeConfig struct {
		prompt string
		fields map[string]string // dag input key → prompt label
	}
	configs := map[string]nodeConfig{
		"retrieve":         {promptRetrieve, map[string]string{"query": "QUERY"}},
		"extract_claims":   {promptExtractClaims, map[string]string{"retrieve": "DOCUMENTS"}},
		"map_evidence":     {promptMapEvidence, map[string]string{"retrieve": "AVAILABLE EVIDENCE", "extract_claims": "CLAIMS"}},
		"critique":         {promptCritique, map[string]string{"map_evidence": "CLAIM-EVIDENCE MAP"}},
		"detect_missing":   {promptDetectMissing, map[string]string{"map_evidence": "EVIDENCE MAP"}},
		"map_language":     {promptMapLanguage, map[string]string{"extract_claims": "CLAIMS"}},
		"scrutinize":       {promptScrutinize, map[string]string{"map_evidence": "EVIDENCE MAP"}},
		"resolve":          {promptResolve, map[string]string{"critique": "CRITIQUE", "detect_missing": "MISSING EVIDENCE", "map_language": "LANGUAGE MAP", "scrutinize": "SCRUTINY REPORT"}},
		"generate_article": {promptGenerateArticle, map[string]string{"resolve": "RESOLVED CLAIMS"}},
	}

		executors := make(map[string]func(context.Context, map[string]interface{}) (interface{}, error))
	for name, cfg := range configs {
		name, cfg := name, cfg
		executors[name] = func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
			// Special case: the retrieve node can use real web search
			// (RealRetrieve) to ground the pipeline in live evidence. When
			// RealRetrieve is nil (no search keys) or fails, we fall back to
			// the LLM-only mode (passes the query to the LLM as before).
			if name == "retrieve" && RealRetrieve != nil {
				query := ""
				if q, ok := input["query"].(string); ok {
					query = q
				}
				if docs, err := RealRetrieve(query); err == nil && len(docs) > 0 {
					// Replace the query input with real documents so the
					// downstream extract_claims node receives them.
					docJSON, _ := json.Marshal(docs)
					input["retrieve"] = json.RawMessage(docJSON)
					// Build the prompt with real documents.
					userPrompt := promptRetrieveReal + "\n\nQUERY:\n" + query + "\n\nREAL DOCUMENTS:\n" + indentJSON(docJSON) + "\n\nReturn JSON only."
					result, err := SendPromptJSON(systemPrompt, userPrompt, epistemicModel)
					if err != nil {
						return nil, fmt.Errorf("dag node %q: %w", name, err)
					}
					var output interface{}
					if err := json.Unmarshal(result, &output); err != nil {
						return nil, fmt.Errorf("dag node %q parse: %w", name, err)
					}
					return output, nil
				}
				// Fall through to LLM-only mode if retrieval yielded nothing.
			}

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}
			var parts []string
			for key, label := range cfg.fields {
				if val, ok := input[key]; ok {
					var s string
					switch v := val.(type) {
					case string:
						s = v
					default:
						b, _ := json.MarshalIndent(v, "", "  ")
						s = string(b)
					}
					parts = append(parts, fmt.Sprintf("%s:\n%s", label, s))
				}
			}
			userPrompt := cfg.prompt + "\n\n" + strings.Join(parts, "\n\n") + "\n\nReturn JSON only."
			result, err := SendPromptJSON(systemPrompt, userPrompt, epistemicModel)
			if err != nil {
				return nil, fmt.Errorf("dag node %q: %w", name, err)
			}
			var output interface{}
			if err := json.Unmarshal(result, &output); err != nil {
				return nil, fmt.Errorf("dag node %q parse: %w", name, err)
			}
			return output, nil
		}
	}
	return executors
}

// indentJSON pretty-prints raw JSON for injection into LLM prompts.
func indentJSON(raw json.RawMessage) string {
	var buf bytes.Buffer
	json.Indent(&buf, raw, "", "  ")
	return buf.String()
}
