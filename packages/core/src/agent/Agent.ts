import { sendPromptStream } from "../llm.js";
import type { AgentEvent } from "../types.js";
import type { Message, ToolDefinition, ToolCall } from "../models.js";
import type { AgentConfig, AgentResult, AgentTool, ToolResult } from "./types.js";

const DEFAULT_MAX_ITERATIONS = 15;
const TOOL_RESULT_TRUNCATION = 1500;

export class Agent {
  private config: AgentConfig;
  private messages: Message[];
  private toolResults: ToolResult[] = [];
  private blocks: any[] = [];
  private eventSubscribers: Array<(event: AgentEvent) => void> = [];
  private iterationCount = 0;
  private aborted = false;
  private toolDefinitions: ToolDefinition[];
  private toolExecutors: Record<string, (args: any) => Promise<ToolResult>>;

  constructor(config: AgentConfig) {
    this.config = config;
    this.messages = [...(config.messages || [])];
    this.toolDefinitions = (config.tools || []).map((t) => t.definition);
    this.toolExecutors = Object.fromEntries(
      (config.tools || []).map((t) => [t.definition.function.name, t.execute])
    );

    // Forward events to both internal handler and config callback
    const onEvent = config.onEvent;
    if (onEvent) {
      this.eventSubscribers.push(onEvent);
    }
  }

  private emit(event: AgentEvent): void {
    for (const cb of this.eventSubscribers) {
      try { cb(event); } catch {}
    }
  }

  subscribe(cb: (event: AgentEvent) => void): () => void {
    this.eventSubscribers.push(cb);
    return () => {
      const idx = this.eventSubscribers.indexOf(cb);
      if (idx >= 0) this.eventSubscribers.splice(idx, 1);
    };
  }

  async run(input: string): Promise<AgentResult> {
    this.iterationCount = 0;
    this.toolResults = [];
    this.blocks = [];

    // Add user message
    this.messages.push({ role: "user", content: input });

    // Estimate: ~4 chars per token, ~1000 tokens per message overhead
    const TOKEN_BUDGET = 90000;
    const CHARS_PER_TOKEN = 4;
    const MAX_CHARS = TOKEN_BUDGET * CHARS_PER_TOKEN;

    while (this.iterationCount < (this.config.maxIterations || DEFAULT_MAX_ITERATIONS)) {
      if (this.aborted) break;
      this.iterationCount++;

      // Context management: estimate total size, summarize oldest if needed
      this.manageContext(MAX_CHARS);

      // Get LLM response with tool calls
      const response = await this.llmCall();

      if (this.aborted) break;

      // If no tool calls, we're done — return the text
      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (response.text) {
          this.messages.push({ role: "assistant", content: response.text });
        }
        return this.buildResult(response.text);
      }

      // Assistant message with tool calls
      this.messages.push({
        role: "assistant",
        content: response.text || null,
        tool_calls: response.toolCalls,
      });

      // Emit text and tool_use events
      if (response.text) {
        this.emit({ type: "text", data: response.text, timestamp: Date.now() });
      }
      for (const tc of response.toolCalls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        this.emit({ type: "tool_use", data: { name: tc.function.name, args }, timestamp: Date.now() });
      }

      // Execute each tool call
      for (const tc of response.toolCalls) {
        if (this.aborted) break;
        const result = await this.executeToolCall(tc);
        this.toolResults.push(result);

        // Emit tool_result event
        this.emit({
          type: "tool_result",
          data: { name: tc.function.name, result: result.result.slice(0, 1000) },
          timestamp: Date.now(),
        });

        // Collect blocks
        if (result.blocks) {
          this.blocks.push(...result.blocks);
        }

        // Add tool result message
        this.messages.push({
          role: "tool",
          content: result.result,
          tool_call_id: tc.id,
          tool_name: tc.function.name,
        });
      }
    }

    // Max iterations reached — return what we have
    const finalText = this.messages.length > 0
      ? (() => {
          for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i].role === "assistant" && this.messages[i].content) {
              return this.messages[i].content!;
            }
          }
          return "Response generated.";
        })()
      : "Response generated.";

    return this.buildResult(finalText);
  }

  private async llmCall(): Promise<{ text: string; toolCalls?: ToolCall[] }> {
    const onEvent = this.config.onEvent;
    return sendPromptStream(
      this.messages,
      (event) => { this.emit(event); },
      {
        system: this.config.systemPrompt,
        model: this.config.modelOverride || this.config.model,
        temperature: this.config.temperature,
        reasoningEffort: this.config.reasoningEffort,
        tools: this.toolDefinitions.length > 0 ? this.toolDefinitions : undefined,
        tool_choice: this.toolDefinitions.length > 0 ? "auto" : undefined,
      }
    );
  }

  private async executeToolCall(tc: ToolCall): Promise<ToolResult> {
    const executor = this.toolExecutors[tc.function.name];
    if (!executor) {
      return { result: `Unknown tool: ${tc.function.name}` };
    }

    let args: any = {};
    try { args = JSON.parse(tc.function.arguments); } catch {
      return { result: `Invalid arguments for ${tc.function.name}: ${tc.function.arguments}` };
    }

    // Validate non-empty args for tools that require them
    if (typeof args === "object" && Object.keys(args).length === 0) {
      const def = this.toolDefinitions.find((d) => d.function.name === tc.function.name);
      const required = (def?.function.parameters as any)?.required;
      if (Array.isArray(required) && required.length > 0) {
        return { result: `Skipped: ${tc.function.name} requires arguments: ${required.join(", ")}` };
      }
    }

    try {
      const result = await executor(args);
      if (result.result && result.result.length > TOOL_RESULT_TRUNCATION) {
        result.result = result.result.slice(0, TOOL_RESULT_TRUNCATION) + "\n[Result truncated]";
      }
      return result;
    } catch (err: any) {
      return { result: `Error executing ${tc.function.name}: ${err.message || err}` };
    }
  }

  private manageContext(maxChars: number): void {
    let totalChars = 0;
    for (const m of this.messages) {
      totalChars += (m.content || "").length;
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          totalChars += tc.function.arguments.length;
        }
      }
    }

    if (totalChars <= maxChars) return;

    // Summarize: remove every other tool result starting from the second message
    // Keep user messages, assistant messages with tool calls
    const summarized: Message[] = [];
    for (const m of this.messages) {
      if (m.role === "tool") {
        // Truncate tool results to 100 chars each
        summarized.push({ ...m, content: (m.content || "").slice(0, 100) });
      } else {
        summarized.push(m);
      }
    }
    this.messages = summarized;

    // If still over budget, remove oldest tool results
    totalChars = 0;
    for (const m of this.messages) {
      totalChars += (m.content || "").length;
    }
    if (totalChars > maxChars) {
      this.messages = this.messages.filter((m) => {
        if (m.role === "tool") return false;
        return true;
      });
    }
  }

  abort(): void {
    this.aborted = true;
  }

  get state(): { messages: Message[]; iterationCount: number } {
    return { messages: this.messages, iterationCount: this.iterationCount };
  }

  reset(): void {
    this.messages = [];
    this.toolResults = [];
    this.blocks = [];
    this.iterationCount = 0;
    this.aborted = false;
  }

  private buildResult(text: string): AgentResult {
    return {
      text,
      messages: this.messages,
      toolResults: this.toolResults,
      blocks: this.blocks,
      iterationCount: this.iterationCount,
    };
  }
}
