import type { JobInfo, JobStatus, AgentEvent } from "./types.js";

type JobCallback = (slug: string, status: JobStatus, info: Partial<JobInfo>) => void;
type AgentEventCallback = (slug: string, event: AgentEvent) => void;

type JobMeta = Record<string, string>;

interface QueueJob {
  slug: string;
  title: string;
  status: JobStatus;
  phase: string;
  createdAt: string;
  error?: string;
  meta?: JobMeta;
}

const MAX_CONCURRENT = parseInt(process.env.ENCARTA_MAX_CONCURRENT || "3", 10);
const MAX_QUEUE_SIZE = parseInt(process.env.ENCARTA_MAX_QUEUE || "100", 10);

class AsyncQueue {
  private queue: QueueJob[] = [];
  private active = new Set<string>();
  private subscribers: Map<string, JobCallback[]> = new Map();
  private agentEventSubscribers: Map<string, AgentEventCallback[]> = new Map();
  private processor: ((slug: string, meta?: JobMeta) => Promise<void>) | null = null;

  setProcessor(fn: (slug: string, meta?: JobMeta) => Promise<void>): void {
    this.processor = fn;
  }

  enqueue(slug: string, meta?: JobMeta): { ok: boolean; error?: string } {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      return { ok: false, error: "Queue full. Please try again later." };
    }

    if (this.active.has(slug)) {
      return { ok: false, error: "Article is already being generated." };
    }

    const existing = this.queue.find((j) => j.slug === slug);
    if (existing) {
      if (existing.status === "error") {
        existing.status = "queued";
        existing.error = undefined;
        existing.meta = meta;
        this.notify(slug, "queued", {});
        this.tick();
      }
      return { ok: true };
    }

    const job: QueueJob = {
      slug,
      title: slug.replace(/-/g, " "),
      status: "queued",
      phase: "pending",
      createdAt: new Date().toISOString(),
      meta,
    };
    this.queue.push(job);
    this.notify(slug, "queued", { phase: "pending" });
    this.tick();
    return { ok: true };
  }

  getJob(slug: string): JobInfo | null {
    const job = this.queue.find((j) => j.slug === slug);
    if (!job) return null;
    return {
      slug: job.slug,
      title: job.title,
      status: job.status,
      phase: job.phase,
      createdAt: job.createdAt,
      error: job.error,
    };
  }

  getAllJobs(): JobInfo[] {
    return this.queue.map((j) => ({
      slug: j.slug,
      title: j.title,
      status: j.status,
      phase: j.phase,
      createdAt: j.createdAt,
      error: j.error,
    }));
  }

  private getNextPendingJob(): QueueJob | null {
    return this.queue.find((j) => j.status === "queued") ?? null;
  }

  updateJob(slug: string, status: JobStatus, info: Partial<JobInfo>): void {
    const job = this.queue.find((j) => j.slug === slug);
    if (job) {
      job.status = status;
      if (info.phase) job.phase = info.phase;
      if (info.error) job.error = info.error;
    }
    try {
      this.notify(slug, status, info);
      for (const cb of this.updateCallbacks) {
        cb(slug, status, info);
      }
    } catch {
      // notify failures (e.g. closed SSE streams) must not break queue state
    }
  }

  onQueueUpdate(callback: (slug: string, status: JobStatus, info: Partial<JobInfo>) => void): void {
    this.updateCallbacks.push(callback);
  }

  private updateCallbacks: ((slug: string, status: JobStatus, info: Partial<JobInfo>) => void)[] = [];

  restoreJob(slug: string, status: JobStatus, phase: string, createdAt: string, meta?: JobMeta): void {
    if (this.queue.find((j) => j.slug === slug)) return;
    const job: QueueJob = {
      slug,
      title: slug.replace(/-/g, " "),
      status,
      phase,
      createdAt,
      meta,
    };
    this.queue.push(job);
    this.notify(slug, status, { phase });
  }

  subscribe(slug: string, callback: JobCallback): () => void {
    if (!this.subscribers.has(slug)) {
      this.subscribers.set(slug, []);
    }
    this.subscribers.get(slug)!.push(callback);
    return () => {
      const callbacks = this.subscribers.get(slug);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx >= 0) callbacks.splice(idx, 1);
      }
    };
  }

  emitAgentEvent(slug: string, event: AgentEvent): void {
    const callbacks = [
      ...(this.agentEventSubscribers.get(slug) ?? []),
      ...(this.agentEventSubscribers.get("__all__") ?? []),
    ];
    for (const cb of callbacks) {
      try { cb(slug, event); } catch { /* ignore subscriber errors */ }
    }
  }

  subscribeAgentEvents(slug: string, callback: AgentEventCallback): () => void {
    if (!this.agentEventSubscribers.has(slug)) {
      this.agentEventSubscribers.set(slug, []);
    }
    this.agentEventSubscribers.get(slug)!.push(callback);
    return () => {
      const callbacks = this.agentEventSubscribers.get(slug);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx >= 0) callbacks.splice(idx, 1);
      }
    };
  }

  subscribeAll(callback: (job: JobInfo) => void): () => void {
    const handler: JobCallback = (slug, status, info) => {
      const job = this.queue.find((j) => j.slug === slug);
      callback({
        slug,
        status,
        phase: info.phase || job?.phase || "pending",
        createdAt: info.createdAt || job?.createdAt || new Date().toISOString(),
        error: info.error,
      });
    };

    const wrapped = (slug: string, status: JobStatus, info: Partial<JobInfo>) => handler(slug, status, info);
    const allKey = "__all__";
    if (!this.subscribers.has(allKey)) {
      this.subscribers.set(allKey, []);
    }
    this.subscribers.get(allKey)!.push(wrapped);
    return () => {
      const callbacks = this.subscribers.get(allKey);
      if (callbacks) {
        const idx = callbacks.indexOf(wrapped);
        if (idx >= 0) callbacks.splice(idx, 1);
      }
    };
  }

  private notify(slug: string, status: JobStatus, info: Partial<JobInfo>): void {
    const callbacks = [
      ...(this.subscribers.get(slug) ?? []),
      ...(this.subscribers.get("__all__") ?? []),
    ];
    for (const cb of callbacks) {
      cb(slug, status, info);
    }
  }

  private async tick(): Promise<void> {
    if (!this.processor) return;

    while (this.active.size < MAX_CONCURRENT) {
      const job = this.getNextPendingJob();
      if (!job) break;

      this.active.add(job.slug);
      this.processJob(job);
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    try {
      this.updateJob(job.slug, "researching", { phase: "starting" });
      await this.processor!(job.slug, job.meta);
      this.active.delete(job.slug);
      this.tick();
    } catch (error) {
      this.active.delete(job.slug);
      this.updateJob(job.slug, "error", {
        phase: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      this.tick();
    }
  }

  deleteJob(slug: string): boolean {
    const idx = this.queue.findIndex((j) => j.slug === slug);
    if (idx === -1) return false;
    this.queue.splice(idx, 1);
    this.active.delete(slug);
    this.notify(slug, "removed", {});
    return true;
  }

  getStats(): { queued: number; active: number; maxConcurrent: number; maxQueue: number } {
    return {
      queued: this.queue.filter((j) => j.status === "queued").length,
      active: this.active.size,
      maxConcurrent: MAX_CONCURRENT,
      maxQueue: MAX_QUEUE_SIZE,
    };
  }

  async shutdown(): Promise<void> {
    this.active.clear();
    this.queue = [];
    this.subscribers.clear();
  }
}

export const queue = new AsyncQueue();
