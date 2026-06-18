"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import GenerationBar, { type GeneratingEntry } from "../components/GenerationBar";
import PageLayout from "../components/PageLayout";
import SectionHeader from "../components/SectionHeader";
import { BASE } from "@/lib/constants";
import type { AgentEvent } from "../components/ProcessViewer";
import { IconLightning, IconClock, IconCheckCircle, IconXCircle, IconX } from "../components/Icons";

interface QueueJob {
  slug: string;
  title?: string;
  status: string;
  phase: string;
  createdAt: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

interface QueueStats {
  queued: number;
  active: number;
  maxConcurrent: number;
  maxQueue: number;
}

interface QueueData {
  jobs: QueueJob[];
  stats: QueueStats;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function jobToEntry(job: QueueJob): GeneratingEntry {
  return {
    slug: job.slug,
    title: job.title || job.slug,
    phase: job.phase || job.status,
    error: job.error,
    agentEvents: job.agentEvents,
  };
}

export default function QueuePage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const agentEventsMapRef = useRef<Record<string, AgentEvent[]>>({});
  const phaseMapRef = useRef<Record<string, string>>({});
  const esRefs = useRef<Map<string, EventSource>>(new Map());
  const activeSlugsRef = useRef<Set<string>>(new Set());

  const updateJob = useCallback((slug: string, patch: Partial<QueueJob>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        jobs: prev.jobs.map((j) => (j.slug === slug ? { ...j, ...patch } : j)),
      };
    });
  }, []);

  const handleAgentEvent = useCallback((slug: string, event: AgentEvent) => {
    const events = [...(agentEventsMapRef.current[slug] || []), event];
    agentEventsMapRef.current[slug] = events;
    updateJob(slug, { agentEvents: events });
  }, [updateJob]);

  const handleProgress = useCallback((slug: string, phase: string) => {
    phaseMapRef.current[slug] = phase;
    updateJob(slug, { phase });
  }, [updateJob]);

  // Poll queue status
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${BASE}/queue`);
        if (!cancelled && res.ok) {
          const json: QueueData = await res.json();
          // Merge in stored agent events
           const jobsWithEvents = json.jobs.map((j) => ({
            ...j,
            phase: phaseMapRef.current[j.slug] || (j.status === "paused" ? "paused" : j.phase),
            error: j.status === "paused" ? j.error : j.error,
            agentEvents: agentEventsMapRef.current[j.slug] || j.agentEvents,
          }));
          setData({ ...json, jobs: jobsWithEvents });
        }
      } catch { /* server may be down */ }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Connect SSE for running/non-done jobs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextActive = new Set<string>();

    const targets = data?.jobs.filter(
      (j) => j.status !== "done" && j.status !== "queued" && !dismissed.has(j.slug)
    ) ?? [];

    for (const job of targets) {
      nextActive.add(job.slug);
      if (esRefs.current.has(job.slug)) continue; // already connected

      const es = new EventSource(`${BASE}/articles/${job.slug}/progress`);
      esRefs.current.set(job.slug, es);

      es.addEventListener("agent_event", (e: MessageEvent) => {
        try {
          const event: AgentEvent = JSON.parse(e.data);
          handleAgentEvent(job.slug, event);
        } catch { /* skip */ }
      });

      es.addEventListener("progress", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const phase = data.status === "paused" ? "paused" : data.phase;
          const error = data.status === "paused" ? data.error : undefined;
          if (phase) {
            phaseMapRef.current[job.slug] = phase;
            updateJob(job.slug, { phase, error });
          }
        } catch { /* skip */ }
      });

      es.onerror = () => { es.close(); esRefs.current.delete(job.slug); };
    }

    // Close SSE for slugs no longer active
    for (const [slug, es] of esRefs.current) {
      if (!nextActive.has(slug) || nextActive !== activeSlugsRef.current) {
        es.close();
        esRefs.current.delete(slug);
      }
    }
    activeSlugsRef.current = nextActive;
  }, [data?.jobs, dismissed, handleAgentEvent, handleProgress]);

  async function cancelJob(slug: string) {
    try {
      const res = await fetch(`${BASE}/queue/${slug}`, { method: "DELETE" });
      if (res.ok) {
        // Close SSE for this job
        esRefs.current.get(slug)?.close();
        esRefs.current.delete(slug);
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, jobs: prev.jobs.filter((j) => j.slug !== slug) };
        });
      }
    } catch { /* ignore */ }
  }

  async function retryJob(slug: string) {
    try {
      await fetch(`${BASE}/articles/${slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "veritas" }),
      });
    } catch { /* ignore */ }
  }

  if (!data) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-[var(--border)] border-t-[#1a1a1a] rounded-full"
              style={{ animation: "spin 0.8s linear infinite" }} />
            <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>Connecting to queue...</p>
          </div>
        </main>
      </PageLayout>
    );
  }

  const visibleJobs = data.jobs.filter((j) => !dismissed.has(j.slug) && j.status !== "done");
  const runningJobs = visibleJobs.filter((j) => j.status !== "queued" && j.status !== "error");
  const queuedJobs = visibleJobs.filter((j) => j.status === "queued");
  const errorJobs = visibleJobs.filter((j) => j.status === "error");
  const doneCount = data.jobs.filter((j) => j.status === "done").length;

  return (
    <PageLayout>
      <main className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
          <div>
            <h1 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>QUEUE MANAGER</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Monitor and manage all generation jobs</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="font-medium" style={{ color: "var(--accent)" }}>{data.stats.active}/{data.stats.maxConcurrent} active</span>
            <span className="font-medium" style={{ color: "var(--blue)" }}>{data.stats.queued}/{data.stats.maxQueue} queued</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass-card-static p-4 text-center">
            <div className="mb-1"><IconLightning size={28} /></div>
            <div className="text-xl font-bold" style={{ color: "var(--accent)" }}>{data.stats.active}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "var(--muted)" }}>Active</div>
          </div>
          <div className="glass-card-static p-4 text-center">
            <div className="mb-1"><IconClock size={28} /></div>
            <div className="text-xl font-bold" style={{ color: "var(--blue)" }}>{data.stats.queued}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "var(--muted)" }}>Queued</div>
          </div>
          <div className="glass-card-static p-4 text-center">
            <div className="mb-1"><IconCheckCircle size={28} /></div>
            <div className="text-xl font-bold" style={{ color: "var(--green)" }}>{doneCount}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "var(--muted)" }}>Done</div>
          </div>
          <div className="glass-card-static p-4 text-center">
            <div className="mb-1"><IconXCircle size={28} /></div>
            <div className="text-xl font-bold" style={{ color: "var(--red)" }}>{errorJobs.length}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "var(--muted)" }}>Errors</div>
          </div>
        </div>

        {/* Active / Running Jobs */}
        <div className="mb-8">
          <SectionHeader icon={IconLightning} title="ACTIVE JOBS" accent="var(--accent)" />
          {runningJobs.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--subtle)" }}>No active jobs. Submit one from the home page or CLI.</p>
          ) : (
            <div className="space-y-2">
              {runningJobs.map((job) => (
                <div key={job.slug} className="relative group">
                  <GenerationBar
                    entry={jobToEntry(job)}
                    showWatchLive={true}
                    onRetry={() => retryJob(job.slug)}
                    onDismiss={() => setDismissed((prev) => new Set(prev).add(job.slug))}
                  />
                  <button
                    onClick={() => cancelJob(job.slug)}
                    className="btn-ghost absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ minWidth: "44px", minHeight: "44px", color: "var(--red)" }}
                    title="Cancel job"
                  >
                    <IconX size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Queued Jobs */}
        <div className="mb-8">
          <SectionHeader icon={IconClock} title="QUEUED JOBS" accent="var(--blue)" />
          {queuedJobs.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--subtle)" }}>No queued jobs.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {queuedJobs.map((job) => (
                <div key={job.slug} className="flex items-center gap-3 p-3 glass-card-static">
                  <IconClock size={20} />
                  <span className="text-sm font-medium truncate flex-1" style={{ color: "var(--ink)" }}>{job.title || job.slug}</span>
                  <span className="text-xs" style={{ color: "var(--subtle)" }}>{timeAgo(job.createdAt)}</span>
                  <button
                    onClick={() => cancelJob(job.slug)}
                    className="btn-ghost shrink-0"
                    style={{ minWidth: "44px", minHeight: "44px", color: "var(--red)" }}
                    title="Cancel job"
                  >
                    <IconX size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Jobs */}
        {errorJobs.length > 0 && (
          <div className="mb-8">
            <SectionHeader icon={IconXCircle} title="ERRORS" accent="var(--red)" />
            <div className="space-y-2">
              {errorJobs.map((job) => (
                <GenerationBar
                  key={job.slug}
                  entry={jobToEntry(job)}
                  showWatchLive={false}
                  onRetry={() => retryJob(job.slug)}
                  onDismiss={() => setDismissed((prev) => new Set(prev).add(job.slug))}
                />
              ))}
            </div>
          </div>
        )}

        {/* Queue Config */}
        <div className="mt-12 glass-card-static p-6">
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wide" style={{ color: "var(--ink)" }}>Configuration</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm" style={{ color: "var(--muted)" }}>
            <div>Max concurrent: <span className="font-bold" style={{ color: "var(--ink)" }}>{data.stats.maxConcurrent}</span></div>
            <div>Max queue size: <span className="font-bold" style={{ color: "var(--ink)" }}>{data.stats.maxQueue}</span></div>
            <div>Set via env: <span className="font-mono text-xs">ENCARTA_MAX_CONCURRENT</span></div>
            <div>Set via env: <span className="font-mono text-xs">ENCARTA_MAX_QUEUE</span></div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
