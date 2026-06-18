import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import {
  createConversation, listConversations, getConversation,
  getMessages, addMessage, updateConversationTitle,
  memRecallAll,
} from "@encarta/storage";
import type { Message } from "@encarta/core";
import { getUserId } from "../shared.js";

const chat = new Hono();

import { runChatAgent } from "../services/chatService.js";

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
      const existingMessages: Message[] = existing.map(dbToAgentMsg);
      await runChatAgent(stream, conversationId, content, selectedModel, existingMessages, existing.length);
    });
});

export default chat;
