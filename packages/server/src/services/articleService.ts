import { SSEStreamingApi } from "hono/streaming";
import { queue } from "@encarta/core";
import { getArticleStatus } from "@encarta/storage";
import { generationCooldowns } from "../shared.js";

export function handleArticleGenerate(slug: string, persona: string, userId?: string | null): void {
  const genKey = `gen:${slug}`;
  generationCooldowns.set(genKey, Date.now() + 60_000);
  const meta: Record<string, string> = { persona, ...(userId ? { generatedBy: userId } : {}) };
  queue.enqueue(slug, meta);
}

export function handleArticleRefresh(slug: string): void {
  queue.enqueue(slug);
}

export function streamArticleProgress(stream: SSEStreamingApi, slug: string): void {
  let unsub: (() => void) | null = null;
  let unsubAgent: (() => void) | null = null;
  const cleanup = () => {
    if (unsub) { unsub(); unsub = null; }
    if (unsubAgent) { unsubAgent(); unsubAgent = null; }
  };
  stream.onAbort(cleanup);
  unsub = queue.subscribe(slug, (s: string, status: string, info: Record<string, unknown>) => {
    try {
      stream.writeSSE({ data: JSON.stringify({ slug: s, status, ...info }), event: "progress" });
    } catch { cleanup(); }
  });
  unsubAgent = queue.subscribeAgentEvents(slug, (s: string, event: import("@encarta/core").AgentEvent) => {
    try {
      stream.writeSSE({ data: JSON.stringify(event), event: "agent_event" });
    } catch { cleanup(); }
  });
  const job = queue.getJob(slug);
  try {
    stream.writeSSE({
      data: JSON.stringify(job || { slug, status: "not_queued", phase: "idle" }),
      event: "progress",
    });
  } catch { cleanup(); }
}
