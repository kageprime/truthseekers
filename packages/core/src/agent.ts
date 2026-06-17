import type { AgentEvent, ModelId } from "./types.js";
import { complete, stream, Type } from "@earendil-works/pi-ai";
import type { Model, Context, Tool, Message as PiMessage, ToolCall as PiToolCall, TextContent, UserMessage, AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";

interface ModelRoute {
  modelId: string;
  modelName: string;
  reasoning: boolean;
}

const MODEL_ROUTES: Record<string, ModelRoute> = {
  "gemma-4-31B-it": { modelId: "gemma-4-31B-it", modelName: "gemma-4-31B-it", reasoning: true },
  "deepseek-4-flash": { modelId: "deepseek-4-flash", modelName: "deepseek-4-flash", reasoning: false },
  "deepseek-v4-pro": { modelId: "deepseek-v4-pro", modelName: "deepseek-v4-pro", reasoning: true },
};

export function resolveModelRoute(model?: string): ModelRoute {
  const id = model || process.env.DO_MODEL || "gemma-4-31B-it";
  return MODEL_ROUTES[id] || MODEL_ROUTES["gemma-4-31B-it"];
}

export function buildModel(route: ModelRoute): Model<"openai-completions"> {
  return {
    id: route.modelId,
    name: route.modelName,
    api: "openai-completions",
    provider: "do-ai",
    baseUrl: "https://inference.do-ai.run/v1",
    reasoning: route.reasoning,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 32768,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: true,
      supportsReasoningEffort: true,
    },
  };
}

const PROMPT_TIMEOUT = parseInt(process.env.PROMPT_TIMEOUT_MS || "300000", 10);

export interface PromptResult {
  text: string;
  structuredOutput?: unknown;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

function piTimestamp(): number {
  return Date.now();
}

function makeEmptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
}

function toPiMessages(msgs: Message[], system?: string): PiMessage[] {
  const pi: PiMessage[] = [];
  for (const m of msgs) {
    if (m.role === "system") {
      pi.push({ role: "user" as const, content: m.content || "", timestamp: piTimestamp() });
    } else if (m.role === "user") {
      pi.push({ role: "user" as const, content: m.content || "", timestamp: piTimestamp() });
    } else if (m.role === "assistant") {
      const content: (TextContent | import("@earendil-works/pi-ai").ToolCall)[] = [];
      if (m.content) content.push({ type: "text" as const, text: m.content });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}
          content.push({ type: "toolCall" as const, id: tc.id, name: tc.function.name, arguments: args });
        }
      }
      const hasToolCalls = content.some((c) => c.type === "toolCall");
      pi.push({
        role: "assistant" as const,
        content,
        timestamp: piTimestamp(),
        usage: makeEmptyUsage(),
        stopReason: hasToolCalls ? "toolUse" as const : "stop" as const,
      } as AssistantMessage);
    } else if (m.role === "tool") {
      pi.push({
        role: "toolResult" as const,
        toolCallId: m.tool_call_id || "",
        toolName: "",
        content: [{ type: "text" as const, text: m.content || "" }],
        isError: false,
        timestamp: piTimestamp(),
      });
    }
  }
  if (system && pi.length > 0 && pi[0].role === "user") {
    const first = pi[0] as UserMessage;
    first.content = `[System Instructions]\n${system}\n\n[Conversation]\n${typeof first.content === "string" ? first.content : ""}`;
  } else if (system) {
    pi.unshift({ role: "user" as const, content: `[System Instructions]\n${system}`, timestamp: piTimestamp() });
  }
  return pi;
}

function toPiTools(defs?: ToolDefinition[]): Tool[] | undefined {
  if (!defs || defs.length === 0) return undefined;
  return defs.map((d) => ({
    name: d.function.name,
    description: d.function.description,
    parameters: Type.Object(
      Object.fromEntries(
        Object.entries((d.function.parameters as any).properties || {}).map(([k, v]: [string, any]) => [
          k,
          v.type === "string" ? Type.String({ description: v.description }) :
          v.type === "number" ? Type.Number({ description: v.description }) :
          v.type === "boolean" ? Type.Boolean({ description: v.description }) :
          v.type === "array" ? Type.Array(Type.Any(), { description: v.description }) :
          v.type === "object" ? Type.Object({}, { description: v.description }) :
          Type.Any({ description: v.description }),
        ])
      ),
      { description: d.function.description }
    ) as any,
  }));
}

export async function sendPrompt(
  messages: Message[],
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: "none" | "low" | "medium" | "high";
  }
): Promise<PromptResult> {
  const route = resolveModelRoute(options?.model);
  const model = buildModel(route);
  const piMsgs = toPiMessages(messages, options?.system);

  const ctx: Context = { messages: piMsgs };
  const result = await complete(model, ctx, {
    maxTokens: options?.maxTokens ?? 16384,
    temperature: options?.temperature ?? 0.7,
    reasoningEffort: options?.reasoningEffort,
    apiKey: process.env.MODEL_ACCESS_KEY || "",
    signal: AbortSignal.timeout(PROMPT_TIMEOUT),
  });

  const text = result.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { text };
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
    tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  }
): Promise<PromptResult & { toolCalls?: ToolCall[] }> {
  const route = resolveModelRoute(options?.model);
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
    }
  }

  return {
    text: fullText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      query,
      limit: maxResults,
      scrapeOptions: { formats: ["markdown"] },
    }),
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
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: false,
    } as any),
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
