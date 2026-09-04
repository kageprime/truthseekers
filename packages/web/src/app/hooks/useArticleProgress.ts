"use client";

import { useEffect, useRef, useCallback } from "react";
import { progressUrl } from "@/lib/api";
import type { AgentEvent } from "../components/ProcessViewer";

export interface ProgressState {
  phase: string;
  error?: string;
  agentEvents: AgentEvent[];
  done: boolean;
  articleSlug: string;
}

export interface ProgressCallbacks {
  onAgentEvent?: (event: AgentEvent) => void;
  onPhase?: (phase: string, error?: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

/**
 * Shared SSE hook for `/articles/:slug/progress`. Use it for the "user is
 * watching a generation in flight" UI. Replaces three independent copies
 * (ArticleClient, articles page, queue page) with one implementation.
 *
 * Returns a `stop()` function that the caller can use to tear down the
 * EventSource manually (e.g. on dismiss). Cleanup also runs on unmount and
 * when the slug changes.
 */
export function useArticleProgress(
  slug: string | null | undefined,
  active: boolean,
  callbacks: ProgressCallbacks = {},
) {
  const esRef = useRef<EventSource | null>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!slug || !active) {
      stop();
      return;
    }
    // Don't double-connect.
    if (esRef.current) return;

    const es = new EventSource(progressUrl(slug));
    esRef.current = es;

    es.addEventListener("agent_event", (e: MessageEvent) => {
      try {
        const event: AgentEvent = JSON.parse(e.data);
        cbRef.current.onAgentEvent?.(event);
      } catch { /* skip malformed */ }
    });

    es.addEventListener("progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === "done") {
          cbRef.current.onPhase?.("done");
          cbRef.current.onDone?.();
          es.close();
          esRef.current = null;
        } else if (data.status === "error") {
          cbRef.current.onPhase?.("error", data.error);
          cbRef.current.onError?.(String(data.error ?? "Unknown error"));
          es.close();
          esRef.current = null;
        } else {
          const phase = data.status === "paused"
            ? "paused"
            : (typeof data.phase === "string" ? data.phase : typeof data.status === "string" ? data.status : "unknown");
          cbRef.current.onPhase?.(phase, data.status === "paused" ? data.error : undefined);
        }
      } catch { /* skip malformed */ }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [slug, active, stop]);

  return { stop };
}