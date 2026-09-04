"use client";

import { useRef, useCallback } from "react";
import { chatProgressUrl, chatStopUrl, authHeaders } from "@/lib/api";
import type { AgentEvent } from "../components/ProcessViewer";

export interface StreamEvent {
  type: string;
  data?: string;
  name?: string;
  content?: string;
  blocks?: any[];
  msgId?: string;
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onToolEvent: (event: AgentEvent) => void;
  onDone: (event: StreamEvent) => void;
  onError: (error: string) => void;
}

export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback((convId?: string) => {
    if (convId) {
      try {
        fetch(chatStopUrl(convId), {
          method: "POST",
          keepalive: true,
          headers: { ...authHeaders() },
        }).catch(() => {});
      } catch {}
    }
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async (id: string, msg: string, callbacks: StreamCallbacks, model?: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = "";

    try {
      const res = await fetch(chatProgressUrl(id), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content: msg, ...(model ? { model } : {}) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to send");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buf = "";

      let receivedDone = false;
      let needsReset = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          try {
            const event: StreamEvent = JSON.parse(payload);
            if (event.type === "text") {
              if (needsReset) { fullText = event.data ?? ""; needsReset = false; }
              else { fullText += event.data ?? ""; }
              callbacks.onText(fullText);
            } else if (event.type === "tool_use" || event.type === "tool_result" || event.type === "trace") {
              needsReset = true;
              if (event.type === "tool_use" || event.type === "tool_result") {
                callbacks.onToolEvent({ type: event.type, data: event.data, timestamp: Date.now() });
              }
            } else if (event.type === "done") {
              receivedDone = true;
              callbacks.onDone(event);
              fullText = "";
              break;
            }
          } catch {}
        }
        if (receivedDone) break;
      }

      reader.cancel();

      if (!receivedDone && fullText) {
        callbacks.onDone({ type: "done", content: fullText });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      if (fullText) {
        callbacks.onDone({ type: "done", content: fullText, blocks: [] });
      }
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }

    abortRef.current = null;
  }, []);

  return { send, stop };
}
