import { randomUUID } from "node:crypto";
import { SSEStreamingApi } from "hono/streaming";
import { Agent, CHAT_TOOL_DEFINITIONS, queue, dedupeBlocks, type Message } from "@encarta/core";
import { memRecallAll, addMessage, updateConversationTitle } from "@encarta/storage";
import { createToolExecutors } from "../tools.js";

const SYSTEM_PROMPT = `You are Truthseekers, an AI encyclopedia agent that renders rich content inline. You MUST use render_blocks for ALL structured data — do NOT format timelines, maps, or lists as plain text/Markdown.

CRITICAL RULES:
1. Call the tool immediately. No preamble, no "I can..." or "I cannot..." text before the tool call.
2. You HAVE video generation via generate_video. Never say you lack it.
3. Never output tool plans like ["tool1", "tool2"] in text.
4. Final text response comes AFTER all tool calls. First tool call, then answer.

### render_blocks — SINGLE TOOL FOR ALL RICH CONTENT
Whenever you present structured information, call render_blocks. You can include multiple blocks of different types in a single call.
Timeline data: Use type "timeline" with events[{ year, event, description }].
Map data: Use type "map_2d" or "map_3d" with markers[{ lat, lng, title, description? }].

Also supports: heading, text, citation, crossref, gallery, diagram (mermaid code), video, divider.

### web_search — search the web
### webfetch — fetch URL content
### article_search — search existing articles
### get_article — look up article by slug
### get_map — look up map by slug
### generate_image — create AI illustration
### generate_video — generate AI video clip
### verify_citation — verify claim against source
### suggest_related — find related articles
### task — delegate parallel research to sub-agent
### create_article — queue article generation
### mem_store — remember user preferences
### mem_recall — recall user preferences`;

export async function runChatAgent(
  stream: SSEStreamingApi,
  conversationId: string,
  content: string,
  selectedModel: string | undefined,
  existingMessages: Message[],
  existingCount: number
) {
  const toolExecutors = createToolExecutors(queue, selectedModel);

  // Load session context (user preferences)
  let sessionContext = "";
  try {
    const allMemories = await memRecallAll();
    if (allMemories.length > 0) {
      sessionContext = "\n\n## User Preferences\n" + allMemories.map((m: any) => `${m.key}: ${m.value}`).join("\n");
    }
  } catch {}

  const agentEvents: any[] = [];

  const agent = new Agent({
    model: selectedModel || "deepseek-4-flash",
    systemPrompt: SYSTEM_PROMPT + sessionContext,
    messages: existingMessages,
    tools: CHAT_TOOL_DEFINITIONS.map((def) => ({
      definition: def,
      execute: toolExecutors[def.function.name] || (async () => ({ result: `Unknown tool: ${def.function.name}` })),
    })),
    onEvent: (event) => {
      agentEvents.push(event);
      try {
        stream.writeSSE({ data: JSON.stringify(event), event: "agent_event" });
      } catch {}
    },
  });

  try {
    const result = await agent.run(content);
    const finalMessages = result.messages;

    // Persist new messages — only the last assistant message is kept
    const safeBlocks = dedupeBlocks(result.blocks);
    let assistantMsgId: string | undefined;
    let lastAssistantIdx = -1;
    for (let i = existingCount; i < finalMessages.length; i++) {
      if (finalMessages[i].role === "assistant") lastAssistantIdx = i;
    }
    for (let i = existingCount; i < finalMessages.length; i++) {
      const m = finalMessages[i];
      const entryId = randomUUID();
      if (m.role === "user") {
        await addMessage(entryId, conversationId, "user", m.content || " ");
      } else if (m.role === "assistant") {
        if (i !== lastAssistantIdx) continue;
        assistantMsgId = entryId;
        await addMessage(entryId, conversationId, "assistant", m.content || " ", safeBlocks, m.tool_calls, undefined, agentEvents);
      } else if (m.role === "tool") {
        await addMessage(entryId, conversationId, "tool", m.content || " ", undefined, undefined, m.tool_call_id, undefined, m.tool_name);
      }
    }

    // Auto-title on first message
    if (existingCount <= 1) {
      const title = content.length > 60 ? content.slice(0, 60) + "..." : content;
      await updateConversationTitle(conversationId, title);
    }

    const blocks = safeBlocks.length > 0 ? safeBlocks : undefined;
    await stream.writeSSE({
      data: JSON.stringify({ type: "done", msgId: assistantMsgId ?? randomUUID(), content: result.text, blocks }),
      event: "agent_event",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    try {
      await stream.writeSSE({
        data: JSON.stringify({ type: "done", msgId: randomUUID(), content: `Error: ${errorMsg}`, blocks: undefined }),
        event: "agent_event",
      });
    } catch {}
  }
}
