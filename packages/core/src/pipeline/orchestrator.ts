import { EventEmitter } from "events";
import { Agent } from "../agent/Agent.js";
import type { AgentEvent, ResearchResult, ArticleOutline, ArticleContent, VerificationResult, MediaGenerationResult } from "../types.js";
import { PIPELINE_TOOL_DEFINITIONS, PIPELINE_TOOL_EXECUTORS } from "./tools.js";
import { articleToBlocks } from "../blocks.js";
import { getRedisSubscriber } from "../redis.js";

export const pipelineEvents = new EventEmitter();

export async function pauseAndVerify(slug: string, verifyData: any): Promise<string> {
  const { queue } = await import("../queue.js");
  queue.updateJob(slug, "paused", { phase: "verify", error: JSON.stringify(verifyData) });

  queue.emitAgentEvent(slug, {
    type: "status",
    data: { message: "Verification failed threshold. Paused for human-in-the-loop review." },
    timestamp: Date.now(),
  });

  return new Promise<string>((resolve) => {
    const onResolve = (action: string) => {
      resolve(action);
      pipelineEvents.off(`resolve:${slug}`, onResolve);
    };
    pipelineEvents.on(`resolve:${slug}`, onResolve);

    try {
      const sub = getRedisSubscriber();
      const redisHandler = (channel: string, message: string) => {
        if (channel === `encarta:job:resolve:${slug}`) {
          onResolve(message);
          sub.off("message", redisHandler);
        }
      };
      sub.subscribe(`encarta:job:resolve:${slug}`).catch(() => {});
      sub.on("message", redisHandler);
    } catch {}
  });
}

type Persona = "veritas" | "pliny";

interface PipelineState {
  topic: string;
  persona: Persona;
  research?: ResearchResult;
  outline?: ArticleOutline;
  content?: ArticleContent;
  verification?: VerificationResult;
  media?: MediaGenerationResult;
}

function parseJSON<T>(text: string, fallback: T): T {
  try { return JSON.parse(text) as T; } catch {}
  const fence = /```(?:json)?\s*([\s\S]*?)```/;
  const m = text.match(fence);
  if (m) { try { return JSON.parse(m[1].trim()) as T; } catch {} }
  return fallback;
}

export async function runPipeline(
  topic: string,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<ArticleContent> {
  const state: PipelineState = { topic, persona };

  const agent = new Agent({
    model: "gemma-4-31B-it",
    reasoningEffort: "high",
    systemPrompt: `You are an encyclopedia article generator. You have access to pipeline tools that let you research, outline, write, verify, correct, and add media to articles.

Follow this process:
1. Call research_topic to gather facts and sources
2. Call outline_article to structure the article sections
3. Call write_draft to write the full article
4. Call verify_article to check the article for accuracy
5. If verification shows issues (confidence < 0.8), call correct_article to fix them
6. Call generate_media to create image prompts and diagrams

Each tool returns data you need for the next step. Read the results carefully and pass the relevant information to the next tool.

Persona: ${persona === "pliny" ? "Pliny mode: be sharp, witty, irreverent but evidence-grounded." : "VERITAS mode: stern, scholarly, unflinching."}`,
    tools: PIPELINE_TOOL_DEFINITIONS.map((def) => ({
      definition: def,
      execute: async (args: any) => {
        const executor = PIPELINE_TOOL_EXECUTORS[def.function.name];
        const res = await executor(args);

        if (def.function.name === "verify_article") {
          const verifyData = res.data as any;
          if (verifyData && (verifyData.confidenceScore < 0.8 || verifyData.verified === false)) {
            const action = await pauseAndVerify(topic, verifyData);
            if (action === "approve") {
              verifyData.verified = true;
              verifyData.confidenceScore = 1.0;
              verifyData.issues = [];
              res.result = JSON.stringify(verifyData);
            }
          }
        }

        return res;
      },
    })),
    maxIterations: 20,
    onEvent,
  });

  const result = await agent.run(
    `Generate a complete encyclopedia article about "${topic}". Start by researching the topic, then outline, write, verify, and add media.`
  );

  // Extract the final article content from the last tool result
  // The write_draft and correct_article tools return the article JSON
  let articleContent: ArticleContent | null = null;

  for (let i = result.messages.length - 1; i >= 0; i--) {
    const m = result.messages[i];
    if (m.role === "tool" && m.content) {
      const parsed = parseJSON<Record<string, unknown>>(m.content, {});
      if (parsed.sections || parsed.title) {
        articleContent = parsed as unknown as ArticleContent;
        break;
      }
    }
  }

  if (!articleContent) {
    // Fallback: search through tool results for write_draft output
    for (const tr of result.toolResults) {
      if (tr.data && (tr.data as any).sections) {
        articleContent = tr.data as unknown as ArticleContent;
        break;
      }
      const parsed = parseJSON<Record<string, unknown>>(tr.result, {});
      if (parsed.sections) {
        articleContent = parsed as unknown as ArticleContent;
        break;
      }
    }
  }

  // Build article content from agent conversation if structured extraction failed
  if (!articleContent) {
    // Try to find the write_draft or correct_article result
    for (const tr of result.toolResults) {
      if (tr.data) {
        const d = tr.data as any;
        if (d.title || d.sections) {
          articleContent = {
            title: d.title || topic,
            abstract: d.abstract || "",
            sections: d.sections || [],
            timeline: d.timeline || [],
            categories: d.categories || [],
            crossrefs: d.crossrefs || [],
            citations: d.citations || [],
            threedScenes: d.threedScenes || [],
          } as ArticleContent;
          break;
        }
      }
    }
  }

  if (!articleContent) {
    return {
      title: topic,
      abstract: "",
      sections: [],
      timeline: [],
      categories: [],
      crossrefs: [],
      citations: [],
      threedScenes: [],
    };
  }

  return articleContent;
}

// Re-export individual phase functions for backward compatibility
export async function researchPhase(
  topic: string,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<ResearchResult> {
  const result = await PIPELINE_TOOL_EXECUTORS.research_topic({ topic, persona });
  return parseJSON<ResearchResult>(result.result, {
    topic, summary: result.result, facts: [], sources: [], relatedTopics: [],
  });
}

export async function outlinePhase(
  topic: string,
  research: ResearchResult,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<ArticleOutline> {
  const result = await PIPELINE_TOOL_EXECUTORS.outline_article({
    topic,
    summary: research.summary,
    sections: JSON.stringify((research.facts || []).map((f) => f.key)),
  });
  const data = (result.data || parseJSON<Record<string, unknown>>(result.result, {})) as any;
  return {
    topic,
    sections: data.sections || [],
    timelineEvents: data.timelineEvents || [],
    suggestedMedia: data.suggestedMedia || [],
    categories: data.categories || [],
  };
}

export async function writePhase(
  topic: string,
  research: ResearchResult,
  outline: ArticleOutline,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<ArticleContent> {
  const result = await PIPELINE_TOOL_EXECUTORS.write_draft({
    topic,
    researchSummary: JSON.stringify(research),
    outlineJson: JSON.stringify(outline),
    persona,
  });
  const data = (result.data || parseJSON<Record<string, unknown>>(result.result, {})) as any;
  return {
    title: data.title || topic,
    abstract: data.abstract || "",
    sections: data.sections || [],
    timeline: data.timeline || [],
    categories: data.categories || [],
    crossrefs: data.crossrefs || [],
    citations: data.citations || [],
    threedScenes: data.threedScenes || [],
  };
}

export async function verifyPhase(
  topic: string,
  research: ResearchResult,
  content: ArticleContent,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<VerificationResult> {
  const result = await PIPELINE_TOOL_EXECUTORS.verify_article({
    topic,
    researchSummary: JSON.stringify(research.facts || []),
    articleSections: JSON.stringify(content.sections?.map((s: any) => ({ id: s.id, title: s.title, content: (s.content || "").slice(0, 300) })) || []),
  });
  const data = (result.data || parseJSON<Record<string, unknown>>(result.result, {})) as any;
  return {
    verified: data.verified || false,
    confidenceScore: data.confidenceScore || 0,
    issues: data.issues || [],
    corrections: data.corrections || [],
    summary: "",
  };
}

export async function applyCorrections(
  topic: string,
  content: ArticleContent,
  verification: VerificationResult,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<ArticleContent> {
  const result = await PIPELINE_TOOL_EXECUTORS.correct_article({
    topic,
    correctionsJson: JSON.stringify({ issues: verification.issues, corrections: verification.corrections }),
    articleJson: JSON.stringify(content),
  });
  const data = (result.data || parseJSON<Record<string, unknown>>(result.result, {})) as any;
  return {
    title: data.title || content.title || topic,
    abstract: data.abstract || content.abstract || "",
    sections: data.sections || content.sections || [],
    timeline: data.timeline || content.timeline || [],
    categories: data.categories || content.categories || [],
    crossrefs: data.crossrefs || content.crossrefs || [],
    citations: data.citations || content.citations || [],
    threedScenes: data.threedScenes || content.threedScenes || [],
  };
}

export async function mediaPhase(
  topic: string,
  outline: ArticleOutline,
  content: ArticleContent,
  persona: Persona = "veritas",
  onEvent?: (event: AgentEvent) => void,
): Promise<MediaGenerationResult> {
  const result = await PIPELINE_TOOL_EXECUTORS.generate_media({
    topic,
    outlineJson: JSON.stringify(outline.suggestedMedia || []),
    articleJson: JSON.stringify(content.sections?.map((s: any) => ({ id: s.id, title: s.title })) || []),
  });
  const data = (result.data || parseJSON<Record<string, unknown>>(result.result, {})) as any;
  return {
    mediaItems: data.mediaItems || [],
  };
}

export { runPipeline as processArticle };
