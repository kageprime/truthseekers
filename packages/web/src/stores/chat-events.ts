"use client";

import { createStore, useStore } from "@/lib/store";
import type { AgentEvent } from "../app/components/ProcessViewer";

// ── Types ──

export interface ChatTextEvent {
  type: "text";
  content: string;
}

export interface ChatToolEvent {
  type: "tool_use" | "tool_result";
  event: AgentEvent;
}

export interface ChatDoneEvent {
  type: "done";
  content: string;
  blocks?: unknown[];
}

export type ChatStreamEvent = ChatTextEvent | ChatToolEvent | ChatDoneEvent;

export interface ChatEventsState {
  convId: string | null;
  fullText: string;
  toolEvents: AgentEvent[];
  blocks: unknown[];
  status: "idle" | "streaming" | "done" | "error";
  error: string | null;
}

// ── Store ──

const initialEventsState: ChatEventsState = {
  convId: null,
  fullText: "",
  toolEvents: [],
  blocks: [],
  status: "idle",
  error: null,
};

export const chatEventsStore = createStore(initialEventsState);

// ── Actions ──

export function resetChatEvents(convId?: string) {
  chatEventsStore.setState(() => ({
    ...initialEventsState,
    convId: convId ?? null,
    status: "streaming" as const,
  }));
}

export function appendChatText(content: string) {
  chatEventsStore.setState((prev) => ({
    ...prev,
    fullText: prev.fullText + content,
  }));
}

export function setChatText(content: string) {
  chatEventsStore.setState((prev) => ({
    ...prev,
    fullText: content,
  }));
}

export function addToolEvent(event: AgentEvent) {
  chatEventsStore.setState((prev) => ({
    ...prev,
    toolEvents: [...prev.toolEvents, event],
  }));
}

export function completeChatEvent(event: { content?: string; blocks?: unknown[] }) {
  chatEventsStore.setState((prev) => ({
    ...prev,
    status: "done" as const,
    fullText: event.content ?? prev.fullText,
    blocks: event.blocks ?? prev.blocks,
  }));
}

export function failChatEvent(error: string) {
  chatEventsStore.setState(() => ({
    ...initialEventsState,
    status: "error" as const,
    error,
  }));
}

export function applyStreamEvent(event: { type: string; data?: unknown; content?: string; blocks?: unknown[] }) {
  switch (event.type) {
    case "text":
      appendChatText(event.data as string);
      break;
    case "tool_use":
    case "tool_result":
      addToolEvent({ type: event.type, data: event.data, timestamp: Date.now() });
      break;
    case "done":
      completeChatEvent(event);
      break;
  }
}

// ── Selector Hooks ──

export function useChatEvents() {
  return useStore(chatEventsStore, (s) => s);
}

export function useChatStatus() {
  return useStore(chatEventsStore, (s) => s.status);
}

export function useChatFullText() {
  return useStore(chatEventsStore, (s) => s.fullText);
}

export function useChatToolEvents() {
  return useStore(chatEventsStore, (s) => s.toolEvents);
}
