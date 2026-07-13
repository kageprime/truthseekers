"use client";

import { createStore, useStore } from "@/lib/store";

// ── Types ──

export interface ChatDraftState {
  drafts: Record<string, string>; // convId → text
}

// ── Persistence helper ──

const DRAFT_KEY = "trs_chat_drafts";

function loadDrafts(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {}
}

// ── Store ──

const initialDraftState: ChatDraftState = {
  drafts: loadDrafts(),
};

export const chatDraftStore = createStore(initialDraftState);

// ── Actions ──

export function setDraft(convId: string, text: string) {
  chatDraftStore.setState((prev) => {
    const drafts = { ...prev.drafts, [convId]: text };
    saveDrafts(drafts);
    return { drafts };
  });
}

export function clearDraft(convId: string) {
  chatDraftStore.setState((prev) => {
    const drafts = { ...prev.drafts };
    delete drafts[convId];
    saveDrafts(drafts);
    return { drafts };
  });
}

// ── Selector Hooks ──

export function useDraft(convId: string | null): string {
  return useStore(chatDraftStore, (s) => (convId ? s.drafts[convId] ?? "" : ""));
}

export function useAllDrafts() {
  return useStore(chatDraftStore, (s) => s.drafts);
}
