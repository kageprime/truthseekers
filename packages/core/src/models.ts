import { complete, stream, Type } from "@earendil-works/pi-ai";
import type { Model, Context, Tool, Message as PiMessage, TextContent } from "@earendil-works/pi-ai";

export interface ModelRoute {
  modelId: string;
  modelName: string;
  reasoning: boolean;
}

const MODEL_ROUTES: Record<string, ModelRoute> = {
  "gemma-4-31B-it": { modelId: "gemma-4-31B-it", modelName: "gemma-4-31B-it", reasoning: true },
  "deepseek-4-flash": { modelId: "deepseek-4-flash", modelName: "deepseek-4-flash", reasoning: false },
  "deepseek-v4-pro": { modelId: "deepseek-v4-pro", modelName: "deepseek-v4-pro", reasoning: true },
};

export function resolveModel(model?: string): ModelRoute {
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

function piTimestamp(): number {
  return Date.now();
}

function makeEmptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface PromptResult {
  text: string;
  structuredOutput?: unknown;
}

export type ToolChoice = "auto" | "none" | { type: "function"; function: { name: string } };

const JSON_SCHEMA_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "structured_output",
    strict: true,
    schema: {} as Record<string, unknown>,
  },
};

export function toPiMessages(msgs: Message[], system?: string): PiMessage[] {
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
      } as any);
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
    const first = pi[0] as any;
    first.content = `[System Instructions]\n${system}\n\n[Conversation]\n${typeof first.content === "string" ? first.content : ""}`;
  } else if (system) {
    pi.unshift({ role: "user" as const, content: `[System Instructions]\n${system}`, timestamp: piTimestamp() });
  }
  return pi;
}

export function toPiTools(defs?: ToolDefinition[]): Tool[] | undefined {
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
