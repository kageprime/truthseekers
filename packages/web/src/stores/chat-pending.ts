"use client";

import { createStore, useStore } from "@/lib/store";

// ── Types ──

export interface PendingQuestion {
  id: string;
  convId: string;
  question: string;
  options?: string[];
  answered: boolean;
}

export interface PendingState {
  questions: PendingQuestion[];
  permissions: { id: string; convId: string; tool: string; args: string }[];
}

// ── Store ──

const initialPendingState: PendingState = {
  questions: [],
  permissions: [],
};

export const chatPendingStore = createStore(initialPendingState);

// ── Actions ──

export function addQuestion(q: PendingQuestion) {
  chatPendingStore.setState((prev) => ({
    ...prev,
    questions: [...prev.questions, q],
  }));
}

export function answerQuestion(id: string) {
  chatPendingStore.setState((prev) => ({
    ...prev,
    questions: prev.questions.map((q) => (q.id === id ? { ...q, answered: true } : q)),
  }));
}

export function removeQuestion(id: string) {
  chatPendingStore.setState((prev) => ({
    ...prev,
    questions: prev.questions.filter((q) => q.id !== id),
  }));
}

export function clearPending(convId: string) {
  chatPendingStore.setState((prev) => ({
    questions: prev.questions.filter((q) => q.convId !== convId),
    permissions: prev.permissions.filter((p) => p.convId !== convId),
  }));
}

export function totalPending() {
  const state = chatPendingStore.getState();
  return state.questions.filter((q) => !q.answered).length + state.permissions.length;
}

// ── Selector Hooks ──

export function usePendingQuestions(convId: string | null) {
  return useStore(chatPendingStore, (s) =>
    convId ? s.questions.filter((q) => q.convId === convId && !q.answered) : [],
  );
}

export function usePendingCount() {
  return useStore(chatPendingStore, () => totalPending());
}
