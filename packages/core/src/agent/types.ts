import type { Message, ToolDefinition, ToolCall } from "../models.js";
import type { AgentEvent } from "../types.js";

export interface ToolResult {
  result: string;
  blocks?: any[];
  data?: Record<string, unknown>;
}

export type ToolExecutor = (args: any) => Promise<ToolResult>;

export interface AgentConfig {
  model?: string;
  systemPrompt?: string;
  messages?: Message[];
  tools?: AgentTool[];
  maxIterations?: number;
  temperature?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  onEvent?: (event: AgentEvent) => void;
  modelOverride?: string;
}

export interface AgentTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

export interface AgentResult {
  text: string;
  messages: Message[];
  toolResults: ToolResult[];
  blocks: any[];
  iterationCount: number;
}

export type { Message, ToolDefinition, ToolCall, AgentEvent };
