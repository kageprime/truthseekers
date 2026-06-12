import { createSession, sendPrompt, sendPromptStream, deleteSession } from "../agent.js";
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

async function extractJSON(response: { text: string; structuredOutput?: unknown }): Promise<object> {
  if (response.structuredOutput) return response.structuredOutput as object;

  let raw = response.text.trim();

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
      // yield to event loop between parse attempts on long responses
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
  sessionId: string,
  text: string,
  opts: { system?: string; noReply?: boolean },
  onEvent?: (event: AgentEvent) => void
) {
  if (onEvent) {
    return sendPromptStream(sessionId, text, onEvent, opts);
  }
  return sendPrompt(sessionId, text, opts);
}

export async function researchPhase(
  topic: string,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<{ result: ResearchResult; sessionId: string }> {
  const sessionId = await createSession(`Research: ${topic}`);

  try {
    const response = await sendWithEvents(
      sessionId,
      `Research: "${topic}". Seek primary sources, patents, declassified documents. Find evidence from all sides. Note any suppression. Identify related topics.

IMPORTANT: Output valid JSON only. No text outside the JSON object.`,
      { system: systemPrompt(persona, RESEARCHER_INSTRUCTIONS) },
      onEvent
    );

    const data = await extractJSON(response);
    return { result: data as ResearchResult, sessionId };
  } catch (error) {
    await deleteSession(sessionId);
    throw error;
  }
}

export async function outlinePhase(
  sessionId: string,
  topic: string,
  research: ResearchResult,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<ArticleOutline> {
  const response = await sendWithEvents(
    sessionId,
    `Outline for: "${topic}".

Research: ${research.summary || "N/A"}
Facts: ${research.facts?.length || 0} | Sources: ${(research.sources || []).map((s: { url: string }) => s.url).join(", ") || "none"}

Include 3-8 logical sections. For contested topics, add "Competing Interpretations" and "Suppressed Evidence" sections. Suggest timeline events, media, and categories.

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, OUTLINER_INSTRUCTIONS) },
    onEvent
  );

  return await extractJSON(response) as ArticleOutline;
}

export async function writePhase(
  sessionId: string,
  topic: string,
  research: ResearchResult,
  outline: ArticleOutline,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<ArticleContent> {
  const response = await sendWithEvents(
    sessionId,
    `Write article: "${topic}".

RESEARCH:
${(research.facts || []).map((f: { key: string; value: string; source: string }) => `- ${f.key}: ${f.value} (Source: ${f.source})`).join("\n") || "none"}

OUTLINE:
${(outline.sections || []).map((s: { id: string; title: string }) => `- ${s.id}: ${s.title}`).join("\n") || "none"}

Categories: ${(outline.categories || []).join(", ") || "none"}
Sources: ${(research.sources || []).map((s: { url: string }) => s.url).join(", ") || "none"}

Write each section in clear, engaging markdown (2-5 paragraphs). Cite sources. Include cross-references. Name suppression where applicable. ${persona === "pliny" ? "Pliny mode: be sharp, witty, irreverent but evidence-grounded." : "VERITAS mode: stern, scholarly, unflinching."}

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, WRITER_INSTRUCTIONS) },
    onEvent
  );

  return await extractJSON(response) as ArticleContent;
}

export async function verifyPhase(
  sessionId: string,
  topic: string,
  research: ResearchResult,
  content: ArticleContent,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<VerificationResult> {
  const issuesList = (content.sections || [])
    .map((s) => `- Section "${s.id}": ${s.content.slice(0, 200)}...`)
    .join("\n");

  const factsList = (research.facts || [])
    .map((f) => `- ${f.key}: ${f.value} (Source: ${f.source})`)
    .join("\n");

  const response = await sendWithEvents(
    sessionId,
    `Verify article: "${topic}".

RESEARCH FACTS:
${factsList || "none"}

ARTICLE SECTIONS:
${issuesList || "none"}

Cross-check every claim against research data. Flag unsupported assertions, contradictions, missing citations.

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, VERIFIER_INSTRUCTIONS) },
    onEvent
  );

  return await extractJSON(response) as VerificationResult;
}

export async function mediaPhase(
  sessionId: string,
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
    sessionId,
    `Generate media for article: "${topic}".

REQUESTED MEDIA:
${mediaRequests || "none"}

Create precise prompts for each media item. For images: DALL-E prompts. For diagrams: mermaid.js code. For 3D: Three.js descriptions.

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, MEDIA_GENERATOR_INSTRUCTIONS) },
    onEvent
  );

  return await extractJSON(response) as MediaGenerationResult;
}

export async function modelingPhase(
  sessionId: string,
  topic: string,
  content: ArticleContent,
  existingMap?: MapEntry,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void
): Promise<{ threedScenes: import("../types.js").ThreeDMapScene[]; status: string }> {
  const locationHint = content.sections
    .filter((s) => s.content.toLowerCase().includes("located") || s.content.toLowerCase().includes("founded") || s.content.toLowerCase().includes("built"))
    .map((s) => `- "${s.title}": ${s.content.slice(0, 200)}`)
    .join("\n");

  const existingScene = existingMap?.threedScene
    ? `Existing map scene: ${JSON.stringify(existingMap.threedScene)}`
    : "No existing 3D scene for this map.";

  const response = await sendWithEvents(
    sessionId,
    `Generate 3D scene for article: "${topic}".

ARTICLE CONTENT:
${content.abstract}

LOCATION-BASED SECTIONS:
${locationHint || "No specific location sections found."}

${existingScene}

Create a 3D map scene with terrain, procedural buildings, and historical annotations based on the article content.

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, MODELER_INSTRUCTIONS) },
    onEvent
  );

  const data = await extractJSON(response) as { threedScenes: import("../types.js").ThreeDMapScene[]; status: string };
  return data;
}

export async function applyCorrections(
  sessionId: string,
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
    sessionId,
    `Apply corrections to article: "${topic}".

ISSUES FOUND:
${issuesJson}

CORRECTIONS TO APPLY:
${correctionsJson}

Revise the article to fix all issues. Maintain the same JSON structure.

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, WRITER_INSTRUCTIONS) },
    onEvent
  );

  return await extractJSON(response) as ArticleContent;
}
