import { sendPrompt, sendPromptStream, webSearch } from "../agent.js";
import type { AgentEvent } from "../types.js";
import type {
  ResearchResult,
  ArticleOutline,
  ArticleContent,
  Persona,
  VerificationResult,
  MediaGenerationResult,
  MapEntry,
} from "../types.js";
import {
  VERITAS_PREAMBLE,
  PLINY_SUFFIX,
  RESEARCHER_INSTRUCTIONS,
  OUTLINER_INSTRUCTIONS,
  WRITER_INSTRUCTIONS,
  VERIFIER_INSTRUCTIONS,
  MEDIA_GENERATOR_INSTRUCTIONS,
  MODELER_INSTRUCTIONS,
} from "../prompts/index.js";

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/g;
const JSON_OBJECT = /\{[\s\S]*\}/;

async function extractJSON(response: { text?: string; structuredOutput?: unknown }): Promise<object> {
  if (response.structuredOutput) return response.structuredOutput as object;

  let raw = (response.text || "").trim();
  if (!raw) throw new Error("Empty response from LLM");

  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = JSON_FENCE.exec(raw)) !== null) {
    results.push(match[1].trim());
  }

  if (results.length === 0) {
    const objMatch = raw.match(JSON_OBJECT);
    if (objMatch) results.push(objMatch[0]);
  }

  if (results.length === 0) {
    throw new Error(`No JSON found in response. Text: ${raw.slice(0, 500)}`);
  }

  for (const candidate of results) {
    try {
      return JSON.parse(candidate);
    } catch {
      await new Promise<void>(resolve => setImmediate(resolve));
      const fixed = candidate
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\\\\\");
      try {
        return JSON.parse(fixed);
      } catch {
        // try next candidate
      }
    }
  }

  throw new Error(
    `Agent returned invalid JSON. First 500 chars: ${raw.slice(0, 500)}`
  );
}

function systemPrompt(persona: Persona, phaseInstructions: string): string {
  let prompt = VERITAS_PREAMBLE + "\n\n" + phaseInstructions;
  if (persona === "pliny") {
    prompt += PLINY_SUFFIX;
  }
  return prompt;
}

async function sendWithEvents(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  onEvent?: (event: AgentEvent) => void,
  options?: { model?: string; maxTokens?: number; temperature?: number; reasoningEffort?: "none" | "low" | "medium" | "high" }
) {
  if (onEvent) {
    return sendPromptStream(messages, onEvent, options);
  }
  return sendPrompt(messages, options);
}

export async function researchPhase(
  topic: string,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<ResearchResult> {
  onEvent?.({ type: "status", data: "Searching web...", timestamp: Date.now() });
  const searchResults = await webSearch(topic);

  const searchContext = searchResults.length > 0
    ? searchResults.map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet.slice(0, 500)}`).join("\n\n")
    : "No web search results available.";

  onEvent?.({ type: "status", data: `Found ${searchResults.length} sources. Analyzing...`, timestamp: Date.now() });

  const response = await sendWithEvents(
    [
      { role: "system", content: systemPrompt(persona, RESEARCHER_INSTRUCTIONS) },
      { role: "user", content: `Research topic: "${topic}"

WEB SEARCH RESULTS:
${searchContext}

Based on the search results above and your knowledge, produce a structured research summary.

Output valid JSON with this exact schema:
{
  "summary": "string — comprehensive summary of findings",
  "facts": [{ "key": "string", "value": "string", "source": "string URL" }],
  "sources": [{ "title": "string", "url": "string", "relevance": "string" }],
  "relatedTopics": ["string"],
  "suppression": ["string — any evidence of suppression, or empty array"]
}

No text outside the JSON object.` }
    ],
    onEvent,
    { model: "deepseek-v4-pro", reasoningEffort: "high", maxTokens: 32768 }
  );

  const data = await extractJSON(response);
  return data as ResearchResult;
}

export async function outlinePhase(
  topic: string,
  research: ResearchResult,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<ArticleOutline> {
  const response = await sendWithEvents(
    [
      { role: "user", content: `Create an outline for an encyclopedia article about: "${topic}".

Research Summary: ${research.summary || "N/A"}
Facts: ${(research.facts || []).map((f: { key: string; value: string }) => `- ${f.key}: ${f.value}`).join("\n") || "none"}
Sources: ${(research.sources || []).map((s: { url: string }) => s.url).join(", ") || "none"}

Include 3-8 logical sections. For contested topics, add "Competing Interpretations" and "Suppressed Evidence" sections. Suggest timeline events, media, and categories.

Output valid JSON with this exact schema:
{
  "title": "string",
  "sections": [{ "id": "string (hyphenated)", "title": "string" }],
  "categories": ["string"],
  "suggestedMedia": [{ "section": "string (section id)", "type": "string", "description": "string" }],
  "timelineEvents": [{ "year": "string", "title": "string", "description": "string" }]
}

No text outside the JSON object.` }
    ],
    onEvent
  );

  return await extractJSON(response) as ArticleOutline;
}

export async function writePhase(
  topic: string,
  research: ResearchResult,
  outline: ArticleOutline,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<ArticleContent> {
  const response = await sendWithEvents(
    [
      { role: "user", content: `Write an encyclopedia article about: "${topic}".

RESEARCH FACTS:
${(research.facts || []).map((f: { key: string; value: string; source: string }) => `- ${f.key}: ${f.value} (Source: ${f.source})`).join("\n") || "none"}

OUTLINE SECTIONS:
${(outline.sections || []).map((s: { id: string; title: string }) => `- ${s.id}: ${s.title}`).join("\n") || "none"}

Categories: ${(outline.categories || []).join(", ") || "none"}
Sources: ${(research.sources || []).map((s: { url: string }) => s.url).join(", ") || "none"}

Write each section in clear, engaging markdown (2-5 paragraphs). Cite sources. Include cross-references. Name suppression where applicable.
${persona === "pliny" ? "Pliny mode: be sharp, witty, irreverent but evidence-grounded." : "VERITAS mode: stern, scholarly, unflinching."}

Output valid JSON with this exact schema:
{
  "title": "string — article title",
  "abstract": "string — 2-3 sentence summary",
  "sections": [{ "id": "string", "title": "string", "content": "string (markdown)", "media": [] }],
  "timeline": [{ "year": "string", "title": "string", "description": "string" }],
  "categories": ["string"],
  "crossrefs": [{ "id": "string", "title": "string", "relationship": "string" }],
  "citations": [{ "title": "string", "url": "string", "relevance": "string" }],
  "threedScenes": []
}

No text outside the JSON object.` }
    ],
    onEvent,
    { model: "deepseek-v4-pro", maxTokens: 32768, reasoningEffort: "high" }
  );

  return await extractJSON(response) as ArticleContent;
}

export async function verifyPhase(
  topic: string,
  research: ResearchResult,
  content: ArticleContent,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<VerificationResult> {
  const issuesList = (content.sections || [])
    .map((s) => `- Section "${s.id}": ${(s.content || "").slice(0, 200)}...`)
    .join("\n");

  const factsList = (research.facts || [])
    .map((f) => `- ${f.key}: ${f.value} (Source: ${f.source})`)
    .join("\n");

  const response = await sendWithEvents(
    [
      { role: "user", content: `Verify this article: "${topic}".

RESEARCH FACTS:
${factsList || "none"}

ARTICLE SECTIONS:
${issuesList || "none"}

Cross-check every claim against research data. Flag unsupported assertions, contradictions, missing citations.

Output valid JSON with this exact schema:
{
  "verified": boolean,
  "confidenceScore": number (0-1),
  "issues": [{ "section": "string", "claim": "string", "issue": "string", "severity": "high|medium|low" }],
  "corrections": [{ "section": "string", "original": "string", "corrected": "string", "reason": "string" }]
}

No text outside the JSON object.` }
    ],
    onEvent
  );

  return await extractJSON(response) as VerificationResult;
}

export async function mediaPhase(
  topic: string,
  outline: ArticleOutline,
  content: ArticleContent,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<MediaGenerationResult> {
  const mediaRequests = (outline.suggestedMedia || [])
    .map((m) => `- Section "${m.section}": ${m.type} — ${m.description}`)
    .join("\n");

  const response = await sendWithEvents(
    [
      { role: "user", content: `Generate media for article: "${topic}".

REQUESTED MEDIA:
${mediaRequests || "none"}

Create precise prompts for each media item. For images: DALL-E prompts. For diagrams: mermaid.js code. For 3D: Three.js descriptions.

Output valid JSON with this exact schema:
{
  "mediaItems": [{ "sectionId": "string", "mediaId": "string", "type": "image|diagram|threed", "prompt": "string", "caption": "string", "src": "" }]
}

No text outside the JSON object.` }
    ],
    onEvent
  );

  return await extractJSON(response) as MediaGenerationResult;
}

export async function modelingPhase(
  topic: string,
  content: ArticleContent,
  existingMap?: MapEntry,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<{ threedScenes: import("../types.js").ThreeDMapScene[]; status: string }> {
  const locationHint = content.sections
    .filter((s) => s.content.toLowerCase().includes("located") || s.content.toLowerCase().includes("founded") || s.content.toLowerCase().includes("built"))
    .map((s) => `- "${s.title}": ${(s.content || "").slice(0, 200)}`)
    .join("\n");

  const existingScene = existingMap?.threedScene
    ? `Existing map scene: ${JSON.stringify(existingMap.threedScene)}`
    : "No existing 3D scene for this map.";

  const response = await sendWithEvents(
    [
      { role: "user", content: `Generate 3D scene for article: "${topic}".

ARTICLE CONTENT:
${content.abstract}

LOCATION-BASED SECTIONS:
${locationHint || "No specific location sections found."}

${existingScene}

Create a 3D map scene with terrain, procedural buildings, and historical annotations based on the article content.

IMPORTANT: Output valid JSON only.` }
    ],
    onEvent
  );

  const data = await extractJSON(response) as { threedScenes: import("../types.js").ThreeDMapScene[]; status: string };
  return data;
}

export async function applyCorrections(
  topic: string,
  content: ArticleContent,
  verification: VerificationResult,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<ArticleContent> {
  if (verification.verified && verification.confidenceScore >= 0.8) {
    return content;
  }

  const correctionsJson = JSON.stringify(verification.corrections, null, 2);
  const issuesJson = JSON.stringify(verification.issues, null, 2);

  const response = await sendWithEvents(
    [
      { role: "user", content: `Apply corrections to article: "${topic}".

ISSUES FOUND:
${issuesJson}

CORRECTIONS TO APPLY:
${correctionsJson}

Revise the article to fix all issues. Maintain the same JSON structure.

IMPORTANT: Output valid JSON only.` }
    ],
    onEvent
  );

  return await extractJSON(response) as ArticleContent;
}
