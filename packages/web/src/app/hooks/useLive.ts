"use client";

import { useEffect, useRef, useState } from "react";
import { BASE } from "@/lib/constants";

const MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

export interface LiveState {
  slug: string;
  viewers: number;
  phase: string;
  lastEvent: string;
  lastEventAt: string;
  live: boolean;
}

export interface GlobalActivity {
  slug: string;
  phase: string;
  kind: string;
  text: string;
  at: string;
}

/**
 * Subscribe to /articles/:slug/live (SSE). Returns the current live state.
 * The server re-broadcasts on every activity tick, so the client just mirrors.
 */
export function useLiveArticle(slug: string | null | undefined): LiveState | null {
  const [state, setState] = useState<LiveState | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!slug || MOCK) {
      setState(null);
      return;
    }
    const es = new EventSource(`${BASE}/articles/${slug}/live`);
    esRef.current = es;
    es.addEventListener("live", (e: MessageEvent) => {
      try {
        setState(JSON.parse(e.data));
      } catch { /* ignore */ }
    });
    es.onerror = () => {
      // Browser auto-reconnects; nothing to do.
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [slug]);

  return state;
}

/**
 * Subscribe to /live/now (SSE). Returns the rolling platform activity feed.
 */
export function useLiveNow(): GlobalActivity[] {
  const [items, setItems] = useState<GlobalActivity[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (MOCK) {
      setStateFallback(setItems);
      return;
    }
    const es = new EventSource(`${BASE}/live/now`);
    esRef.current = es;
    es.addEventListener("activity", (e: MessageEvent) => {
      try {
        setItems(JSON.parse(e.data));
      } catch { /* ignore */ }
    });
    es.onerror = () => { /* auto-reconnect */ };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return items;
}

// ponytail: in mock mode, replay a static sequence so the UI still has motion
// to demo against. Real backend events replace this when the API is connected.
function setStateFallback(setItems: (v: GlobalActivity[]) => void) {
  const now = Date.now();
  setItems(
    [
      { slug: "jfk-assassination", phase: "extract_claims", kind: "progress", text: "extracting claims", at: new Date(now - 4_000).toISOString() },
      { slug: "roman-empire", phase: "complete", kind: "article_complete", text: "article published", at: new Date(now - 38_000).toISOString() },
      { slug: "photosynthesis", phase: "critique", kind: "progress", text: "critiquing evidence", at: new Date(now - 71_000).toISOString() },
      { slug: "black-hole", phase: "resolve", kind: "progress", text: "resolving contradictions", at: new Date(now - 124_000).toISOString() },
    ].map((x) => ({ ...x })),
  );
}
