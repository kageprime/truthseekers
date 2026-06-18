import { resolveModel, buildModel, toPiMessages, toPiTools } from "./models.js";
import type { Message, ToolDefinition, ToolChoice, PromptResult, ToolCall, Usage } from "./models.js";
import { complete, stream } from "@earendil-works/pi-ai";
import type { Context, TextContent } from "@earendil-works/pi-ai";
import type { AgentEvent } from "./types.js";

const PROMPT_TIMEOUT = parseInt(process.env.PROMPT_TIMEOUT_MS || "300000", 10);

export async function sendPrompt(
  messages: Message[],
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: "none" | "low" | "medium" | "high";
    schema?: Record<string, unknown>;
  }
): Promise<PromptResult> {
  const route = resolveModel(options?.model);
  const model = buildModel(route);
  const piMsgs = toPiMessages(messages, options?.system);

  const ctx: Context = { messages: piMsgs };

  const responseFormat = options?.schema
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: "structured_output",
          strict: true,
          schema: options.schema,
        },
      }
    : undefined;

  const result = await complete(model, ctx, {
    maxTokens: options?.maxTokens ?? 16384,
    temperature: options?.temperature ?? 0.7,
    reasoningEffort: options?.reasoningEffort,
    apiKey: process.env.MODEL_ACCESS_KEY || "",
    signal: AbortSignal.timeout(PROMPT_TIMEOUT),
    responseFormat,
  });

  const text = result.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    ...(options?.schema && text ? { structuredOutput: tryParseJSON(text) } : {}),
  };
}

function tryParseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const fence = /```(?:json)?\s*([\s\S]*?)```/;
  const m = text.match(fence);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {
      try { return JSON.parse(objMatch[0].replace(/,\s*([}\]])/g, "$1")); } catch {}
    }
  }
  return null;
}

export async function sendPromptStream(
  messages: Message[],
  onEvent?: (event: AgentEvent) => void,
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: "none" | "low" | "medium" | "high";
    tools?: ToolDefinition[];
    tool_choice?: ToolChoice;
  }
): Promise<PromptResult & { toolCalls?: ToolCall[] }> {
  const route = resolveModel(options?.model);
  const model = buildModel(route);
  const piMsgs = toPiMessages(messages, options?.system);
  const piTools = toPiTools(options?.tools);

  const ctx: Context = { messages: piMsgs, tools: piTools };
  const s = stream(model, ctx, {
    maxTokens: options?.maxTokens ?? 16384,
    temperature: options?.temperature ?? 0.7,
    reasoningEffort: options?.reasoningEffort,
    toolChoice: options?.tool_choice === "none" ? "none" :
      options?.tool_choice && typeof options.tool_choice === "object"
        ? { type: "function", function: { name: (options.tool_choice as any).function.name } }
        : undefined,
    apiKey: process.env.MODEL_ACCESS_KEY || "",
    signal: AbortSignal.timeout(PROMPT_TIMEOUT),
  });

  let fullText = "";
  const toolCalls: ToolCall[] = [];
  let usage: Usage | undefined;

  for await (const event of s) {
    switch (event.type) {
      case "text_delta":
        fullText += event.delta;
        onEvent?.({ type: "text", data: event.delta, timestamp: Date.now() });
        break;
      case "toolcall_end":
        toolCalls.push({
          id: event.toolCall.id,
          type: "function",
          function: { name: event.toolCall.name, arguments: JSON.stringify(event.toolCall.arguments) },
        });
        break;
      case "done":
        usage = event.message.usage;
        break;
    }
  }

  return {
    text: fullText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage,
  };
}

export async function webSearch(
  query: string,
  maxResults: number = 5
): Promise<{ title: string; url: string; snippet: string }[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    console.warn("FIRECRAWL_API_KEY not set, skipping web search");
    return [];
  }

  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ query, limit: maxResults, scrapeOptions: { formats: ["markdown"] } }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`Firecrawl search failed (${res.status}): ${body}`);
    return [];
  }

  const data = await res.json();
  if (!data.success) {
    console.warn(`Firecrawl search returned success=false`, JSON.stringify(data));
    return [];
  }

  return (data.data || []).map((r: any) => ({
    title: r.title || r.metadata?.title || "",
    url: r.url || "",
    snippet: r.markdown ? r.markdown.slice(0, 1000) : r.description || "",
  }));
}

export async function tavilySearch(
  query: string,
  maxResults: number = 5
): Promise<{ title: string; url: string; snippet: string }[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("TAVILY_API_KEY not set, skipping Tavily search");
    return [];
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ api_key: key, query, max_results: maxResults, search_depth: "advanced", include_answer: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`Tavily search failed (${res.status}): ${body}`);
    return [];
  }

  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content ? r.content.slice(0, 1000) : "",
  }));
}

export async function embedText(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY || process.env.MODEL_ACCESS_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY or MODEL_ACCESS_KEY for embeddings");
  
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: text, model: "text-embedding-3-small" }),
  });
  
  if (!res.ok) {
    throw new Error(`Embedding failed: ${await res.text()}`);
  }
  
  const data = await res.json();
  return data.data[0].embedding;
}
