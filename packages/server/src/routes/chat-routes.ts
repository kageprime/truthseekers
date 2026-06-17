import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import {
  createConversation, listConversations, getConversation,
  getMessages, addMessage, updateConversationTitle,
  memRecallAll,
} from "@encarta/storage";
import { CHAT_TOOL_DEFINITIONS, Agent } from "@encarta/core";
import type { Message } from "@encarta/core";
import { getUserId } from "../shared.js";
import { createToolExecutors } from "../tools.js";
import { queue } from "@encarta/core";

const chat = new Hono();

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

// Convert DB message to Agent Message format
function dbToAgentMsg(m: any): Message {
  if (m.role === "user") {
    let text = m.content || "";
    if (Array.isArray(m.content)) {
      text = m.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }
    return { role: "user", content: text };
  }
  if (m.role === "assistant") {
    return { role: "assistant", content: m.content || null, tool_calls: m.tool_calls || undefined };
  }
  if (m.role === "tool") {
    return { role: "tool", content: m.content || " ", tool_call_id: m.tool_call_id };
  }
  return { role: "user", content: m.content || "" };
}

chat.post("/chat", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  const { title } = await c.req.json<{ title?: string }>();
  const id = randomUUID();
  const conv = await createConversation(id, title || "New Chat", userId);
  return c.json(conv);
});

chat.get("/chat", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  const convs = await listConversations(userId);
  return c.json(convs);
});

chat.get("/chat/:id", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  const id = c.req.param("id");
  const conv = await getConversation(id);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);
  const messages = await getMessages(id);
  return c.json({ ...conv, messages });
});

chat.post("/chat/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const { content, model: selectedModel } = await c.req.json<{ content: string; model?: string }>();
  if (!content) return c.json({ error: "Message content required" }, 400);

  const conv = await getConversation(conversationId);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);
  const existing = await getMessages(conversationId);

  return streamSSE(c, async (stream) => {
    const toolExecutors = createToolExecutors(queue, selectedModel);
    const existingMessages: Message[] = existing.map(dbToAgentMsg);

    // Load session context (user preferences)
    let sessionContext = "";
    try {
      const allMemories = await memRecallAll();
      if (allMemories.length > 0) {
        sessionContext = "\n\n## User Preferences\n" + allMemories.map((m: any) => `${m.key}: ${m.value}`).join("\n");
      }
    } catch {}

    const agent = new Agent({
      model: selectedModel || "deepseek-4-flash",
      systemPrompt: SYSTEM_PROMPT + sessionContext,
      messages: existingMessages,
      tools: CHAT_TOOL_DEFINITIONS.map((def) => ({
        definition: def,
        execute: toolExecutors[def.function.name] || (async () => ({ result: `Unknown tool: ${def.function.name}` })),
      })),
      onEvent: (event) => {
        try {
          stream.writeSSE({ data: JSON.stringify(event), event: "agent_event" });
        } catch {}
      },
    });

    try {
      const result = await agent.run(content);
      const finalMessages = result.messages;

      // Persist new messages
      const savedBase = existing.length;
      for (let i = savedBase; i < finalMessages.length; i++) {
        const m = finalMessages[i];
        const entryId = randomUUID();
        if (m.role === "user") {
          await addMessage(entryId, conversationId, "user", m.content || " ");
        } else if (m.role === "assistant") {
          await addMessage(entryId, conversationId, "assistant", m.content || " ", result.blocks.length > 0 ? result.blocks : undefined, m.tool_calls);
        } else if (m.role === "tool") {
          await addMessage(entryId, conversationId, "tool", m.content || " ", undefined, undefined, m.tool_call_id);
        }
      }

      // Auto-title on first message
      if (existing.length <= 1) {
        const title = content.length > 60 ? content.slice(0, 60) + "..." : content;
        await updateConversationTitle(conversationId, title);
      }

      const blocks = result.blocks.length > 0 ? result.blocks : undefined;
      await stream.writeSSE({
        data: JSON.stringify({ type: "done", msgId: randomUUID(), content: result.text, blocks }),
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
  });
});

export default chat;
