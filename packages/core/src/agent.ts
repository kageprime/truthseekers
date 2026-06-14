import type { AgentEvent } from "./types.js";

const DO_BASE = "https://inference.do-ai.run";
const DO_KEY = () => process.env.MODEL_ACCESS_KEY || "";
const DEFAULT_MODEL = process.env.DO_MODEL || "gemma-4";
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
  const msgs: Message[] = [];
  if (options?.system) msgs.push({ role: "system", content: options.system });
  msgs.push(...messages);

  const body: Record<string, unknown> = {
    model: options?.model || DEFAULT_MODEL,
    messages: msgs,
    max_tokens: options?.maxTokens ?? 16384,
    temperature: options?.temperature ?? 0.7,
    stream: false,
  };
  if (options?.reasoningEffort) body.reasoning_effort = options.reasoningEffort;

  const res = await fetch(`${DO_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DO_KEY()}`,
    },
    signal: AbortSignal.timeout(PROMPT_TIMEOUT),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`DO API error (${res.status}): ${err.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  return { text: content };
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
  const msgs: Message[] = [];
  if (options?.system) msgs.push({ role: "system", content: options.system });
  msgs.push(...messages);

  const body: Record<string, unknown> = {
    model: options?.model || DEFAULT_MODEL,
    messages: msgs,
    max_tokens: options?.maxTokens ?? 16384,
    temperature: options?.temperature ?? 0.7,
    stream: true,
  };
  if (options?.reasoningEffort) body.reasoning_effort = options.reasoningEffort;
  if (options?.tools) body.tools = options.tools;
  if (options?.tool_choice) body.tool_choice = options.tool_choice;

  const res = await fetch(`${DO_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DO_KEY()}`,
    },
    signal: AbortSignal.timeout(PROMPT_TIMEOUT),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`DO API error (${res.status}): ${err.slice(0, 500)}`);
  }

  if (!res.body) throw new Error("No response body for streaming");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";
  const toolCallsMap = new Map<number, { id: string; name: string; args: string }>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6).trim();
      if (payload === "[DONE]") break;

      try {
        const chunk = JSON.parse(payload);
        const choice = chunk.choices?.[0];

        // Text delta
        const delta = choice?.delta?.content || "";
        if (delta) {
          fullText += delta;
          onEvent?.({
            type: "text",
            data: delta,
            timestamp: Date.now(),
          });
        }

        // Tool call deltas
        const toolDeltas = choice?.delta?.tool_calls;
        if (toolDeltas) {
          for (const tc of toolDeltas) {
            const idx = tc.index;
            if (!toolCallsMap.has(idx)) {
              toolCallsMap.set(idx, { id: tc.id || "", name: "", args: "" });
            }
            const entry = toolCallsMap.get(idx)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
          }
        }

        // Finish reason
        if (choice?.finish_reason === "tool_calls") {
          onEvent?.({
            type: "status",
            data: "Calling tools...",
            timestamp: Date.now(),
          });
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  const toolCalls: ToolCall[] = [];
  for (const [, entry] of toolCallsMap) {
    if (entry.name) {
      toolCalls.push({
        id: entry.id,
        type: "function",
        function: { name: entry.name, arguments: entry.args },
      });
    }
  }

  return { text: fullText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
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
    }),
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