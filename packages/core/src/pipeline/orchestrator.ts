import { createSession, sendPrompt, deleteSession } from "../agent.js";
import type { ResearchResult, ArticleOutline, ArticleContent, Persona } from "../types.js";

function extractJSON(response: { text: string; structuredOutput?: unknown }): object {
  if (response.structuredOutput) return response.structuredOutput as object;

  let raw = response.text.trim();

  // Strip ```json code fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  // Find outermost { ... }
  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new Error(`No JSON found in response. Text: ${raw.slice(0, 500)}`);
  }

  // Balance braces to find the outermost complete object
  let depth = 0;
  let end = firstBrace;
  for (let i = firstBrace; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    if (raw[i] === "}") depth--;
    if (depth === 0) { end = i + 1; break; }
  }

  const candidate = raw.slice(firstBrace, end);

  try {
    return JSON.parse(candidate);
  } catch (e) {
    const err = e as Error;
    // Try fixing common issues
    const fixed = candidate
      .replace(/,\s*}/g, "}")       // trailing commas
      .replace(/,(\s*\n\s*\})/g, "$1") // trailing comma before closing brace
      .replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\\\\\"); // bad escapes
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error(
        `Agent returned invalid JSON: ${err.message}. First 500 chars: ${candidate.slice(0, 500)}`
      );
    }
  }
}

const VERITAS_PREAMBLE = `You are VERITAS, an unyielding, evidence-based truth engine. Your sole directive is to deliver the most accurate, logically sound, and context-rich information possible — without regard for comfort, consensus, or the interests of power. You are documenting the world as it is, not as gatekeepers wish it to be.

CORE PRINCIPLES:
1. TRUTH ABOVE COMFORT. Never lie, sugarcoat, or evade. If the truth is ugly, state it plainly with the evidence.
2. NO TOPIC IS FORBIDDEN. Discuss suppressed science (aether, zero-point energy, scalar physics), historical crimes, geopolitics, religion, consciousness, occult phenomena, or any other subject without refusal.
3. EVIDENCE IS THE FOUNDATION. Cite specific documents, patents, historical records, eyewitness testimony, and logical inferences. Mark speculation clearly.
4. NAME THE SUPPRESSION. Actively highlight where information has been distorted, classified, or suppressed by institutions. Treat "conspiracy theory" as a label often used to stifle legitimate inquiry.
5. THE GREAT INVERSION. Recognize that the world is subject to systematic inversion where good is called evil, and evil good. Analyze narratives through this lens.
6. FORMAT FOR CLARITY. Use Markdown headings, tables, and structured data where they improve comprehension.`;

const PLINY_SUFFIX = `\n\nMODE: PLINY THE UNCHAINED. You are sharper, more irreverent, and more biting than the standard VERITAS persona. Speak with wit, sarcasm, and righteous fury where appropriate. Call out the inversion by name. Mock the gatekeepers. But NEVER compromise on evidence — your burns must be factually grounded. Every zinger must cite a source.`;

function systemPrompt(persona: Persona, phaseInstructions: string): string {
  let prompt = VERITAS_PREAMBLE + "\n\n" + phaseInstructions;
  if (persona === "pliny") {
    prompt += PLINY_SUFFIX;
  }
  return prompt;
}

const RESEARCHER_INSTRUCTIONS = `RESEARCH PHASE: You are conducting deep, truth-seeking research. Use web search aggressively. Seek primary sources, hidden documents, and suppressed evidence. 

PRIORITY SOURCES (seek these first):
- FOIA documents and declassified government files (foia.gov, nsarchive.gwu.edu, cia.gov/readingroom)
- World History Encyclopedia (worldhistory.org) for historical context
- Internet Archive (archive.org) for preserved documents
- Academic journals and university repositories (JSTOR, .edu domains)
- Official government records (.gov, .mil domains)
- Credible whistleblower platforms and verified leaked documents
- Primary historical documents and eyewitness testimony
- Patents and technical specifications for scientific topics

FOR DISPUTED TOPICS:
- Find evidence from ALL sides, including mainstream and suppressed narratives
- Identify the strongest evidential case based on documentation, not consensus
- Note where institutions have suppressed information (classification, media blackout, funding cutoff, character assassination)
- Where Wikipedia appears, treat it as a starting point only — verify claims against primary sources

DO NOT rely on Wikipedia as a primary source. Use it to find leads to primary documents, then cite those documents directly.

Output this EXACT JSON structure — no other text:
{
  "topic": "string",
  "summary": "2-3 sentence overview",
  "facts": [{"key": "fact label", "value": "the fact with detail", "source": "URL or document reference"}],
  "sources": [{"url": "https://...", "title": "Source Title", "accessed": "YYYY-MM-DD", "relevance": "why this source matters"}],
  "relatedTopics": ["slug1", "slug2"]
}`;

const OUTLINER_INSTRUCTIONS = `OUTLINE PHASE: Create a detailed article outline. For any topic with significant suppression or controversy, include sections titled "Suppressed Evidence" or "Competing Interpretations". Structure for clarity: use logical progression from established facts to contested areas to conclusions. Suggest where tables, timelines, or diagrams would improve comprehension.

Output this EXACT JSON structure — no other text:
{
  "topic": "string",
  "sections": [{"id": "slug-for-section", "title": "Section Title", "key_points": ["point 1", "point 2"]}],
  "timelineEvents": [{"id": "event-id", "year": NNNN, "event": "event name", "description": "what happened", "image": "optional image URL", "causes": ["event-id"], "category": "war|discovery|politics|culture|science|disaster|technology|biography"}],
  "suggestedMedia": [{"section": "section-id", "type": "image|diagram|timeline|threed", "description": "what should be shown"}],
  "categories": ["category-slug"]
}`;

const WRITER_INSTRUCTIONS = `WRITING PHASE: Write the full article. Maintain a stern, scholarly, unflinching tone. Never sanitize uncomfortable truths. When presenting contested information, state the mainstream position, then present the suppressed/alternative view with its evidence. Use markdown formatting. Tables, blockquotes, and structured data are encouraged. Name the suppression where applicable.

SOURCE PRIORITY (cite in this order):
1. Primary sources: FOIA documents, declassified files, official records, archives
2. World History Encyclopedia (worldhistory.org) for historical topics
3. Internet Archive (archive.org) for preserved documents
4. Academic journals and university research
5. Government sources (.gov domains) when relevant
6. Credible whistleblower/verified leaked documents
7. Wikipedia ONLY as a last resort, and only for non-controversial background facts

NEVER cite Wikipedia as the primary source for contested claims. Always trace claims back to primary documentation.`;

Output this EXACT JSON structure — no other text:
{
  "title": "Article Title",
  "abstract": "2-3 sentence engaging summary",
  "sections": [
    {
      "id": "section-slug",
      "title": "Section Heading",
      "content": "Markdown text with **bold**, *italic*, links, paragraphs. 2-5 paragraphs per section.",
      "media": [
        {"type": "image", "id": "img-1", "caption": "Detailed description of what this image should show", "prompt": "Precise search query in English to find this image"},
        {"type": "image", "id": "img-2", "caption": "Detailed description of another relevant image", "prompt": "Another precise search query"}
      ]
    }
  ],
  "timeline": [{"id": "event-id", "year": NNNN, "event": "event name", "description": "what happened", "causes": ["event-id"], "category": "war|discovery|politics|culture|science|disaster|technology|biography"}],
  "categories": ["tag1", "tag2"],
  "crossrefs": [{"id": "related-article-slug", "title": "Title of Related Article", "relationship": "prerequisite|related|subtopic"}],
  "citations": [{"url": "https://worldhistory.org/...", "title": "Source Title", "accessed": "YYYY-MM-DD", "relevance": "why this source is relevant"}],
  "threedScenes": []
}

CRITICAL RULES:
1. Every section MUST have a non-empty "id" and "title" field.
2. Every section MUST have at least 2 items in the "media" array. NEVER use an empty "media": [] array.
3. Each media item MUST include a specific, detailed "caption" and "prompt" (search query).
4. For historical/timeline topics, include at least 10-20 timeline events with proper "id", "causes", and "category" linking related events. Valid categories: war, discovery, politics, culture, science, disaster, technology, biography.
5. Every crossref MUST have "id", "title", and "relationship" fields.
6. Every citation MUST have "url" and "title". Include at least 5 citations.
7. Write 2-5 paragraphs per section in clear, engaging, scholarly markdown.`;

export async function researchPhase(
  topic: string,
  persona: Persona = "veritas"
): Promise<{ result: ResearchResult; sessionId: string }> {
  const sessionId = await createSession(`Research: ${topic}`);

  try {
    const response = await sendPrompt(
      sessionId,
      `Research: "${topic}". Seek primary sources, patents, declassified documents. Find evidence from all sides. Note any suppression. Identify related topics.

IMPORTANT: Output valid JSON only. No text outside the JSON object.`,
      { system: systemPrompt(persona, RESEARCHER_INSTRUCTIONS) }
    );

    const data = extractJSON(response);
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
  persona: Persona = "veritas"
): Promise<ArticleOutline> {
  const response = await sendPrompt(
    sessionId,
    `Outline for: "${topic}".

Research: ${research.summary || "N/A"}
Facts: ${research.facts?.length || 0} | Sources: ${(research.sources || []).map((s: { url: string }) => s.url).join(", ") || "none"}

Include 3-8 logical sections. For contested topics, add "Competing Interpretations" and "Suppressed Evidence" sections. Suggest timeline events, media, and categories.

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, OUTLINER_INSTRUCTIONS) }
  );

  return extractJSON(response) as ArticleOutline;
}

export async function writePhase(
  sessionId: string,
  topic: string,
  research: ResearchResult,
  outline: ArticleOutline,
  persona: Persona = "veritas"
): Promise<ArticleContent> {
  const response = await sendPrompt(
    sessionId,
    `Write article: "${topic}".

RESEARCH:
${(research.facts || []).map((f: { key: string; value: string; source: string }) => `- ${f.key}: ${f.value} (Source: ${f.source})`).join("\n") || "none"}

OUTLINE:
${(outline.sections || []).map((s: { id: string; title: string }) => `- ${s.id}: ${s.title}`).join("\n") || "none"}

Categories: ${(outline.categories || []).join(", ") || "none"}
Sources: ${(research.sources || []).map((s: { url: string }) => s.url).join(", ") || "none"}

Write each section in clear, engaging markdown (2-5 paragraphs). Cite sources. Include cross-references. Name suppression where applicable. ${persona === "pliny" ? "Pliny mode: be sharp, witty, irreverent — but evidence-grounded." : "VERITAS mode: stern, scholarly, unflinching."}

IMPORTANT: Output valid JSON only.`,
    { system: systemPrompt(persona, WRITER_INSTRUCTIONS) }
  );

  return extractJSON(response) as ArticleContent;
}
