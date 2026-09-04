"use client";

import { useState, useCallback } from "react";
import GenerationBar, { type GeneratingEntry } from "../components/GenerationBar";
import PageLayout from "../components/PageLayout";
import SectionHeader from "../components/SectionHeader";
import type { AgentEvent } from "../components/ProcessViewer";
import { useQueue, useCancelQueueJob, useGenerateArticle, useArticleProgress } from "../hooks";
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

/**
 * Wraps a single running job with its own SSE connection via
 * `useArticleProgress`. Local state (agent events, phase) from SSE survives
 * re-renders caused by the 2 s queue poll — the polled `job` prop is merged
 * with the SSE-derived state for display.
 */
function RunningJobCard({
  job,
  onCancel,
  onDismiss,
}: {
  job: QueueJob;
  onCancel: (slug: string) => void;
  onDismiss: (slug: string) => void;
}) {
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>(job.agentEvents ?? []);
  const [phase, setPhase] = useState<string>(job.phase || job.status);

  useArticleProgress(job.slug, true, {
    onAgentEvent: useCallback((event: AgentEvent) => {
      setAgentEvents((prev) => [...prev, event]);
    }, []),
    onPhase: useCallback((p: string) => {
      setPhase(p);
    }, []),
  });

  const entry: GeneratingEntry = {
    slug: job.slug,
    title: job.title || job.slug,
    phase: phase || job.phase || job.status,
    error: job.error,
    agentEvents: agentEvents.length > 0 ? agentEvents : job.agentEvents,
  };

  return (
    <div className="relative group">
      <GenerationBar
        entry={entry}
        showWatchLive={true}
        onRetry={() => onCancel(job.slug)}
        onDismiss={() => onDismiss(job.slug)}
      />
      <button
        onClick={() => onCancel(job.slug)}
        className="btn-ghost absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ minWidth: "44px", minHeight: "44px", color: "var(--red)" }}
        title="Cancel job"
      >
        <IconX size={16} />
      </button>
    </div>
  );
}

export default function QueuePage() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { data } = useQueue(2000);
  const { mutate: cancelJob } = useCancelQueueJob();
  const { mutate: generateArticle } = useGenerateArticle();

  function handleCancel(slug: string) {
    cancelJob(slug);
  }

  function handleRetry(slug: string) {
    generateArticle({ slug });
  }

  function handleDismiss(slug: string) {
    setDismissed((prev) => new Set(prev).add(slug));
  }

  if (!data) {
    return (
      <PageLayout className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[var(--border)] border-t-[#1a1a1a] rounded-full"
            style={{ animation: "spin 0.8s linear infinite" }} />
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>Connecting to queue...</p>
        </div>
      </PageLayout>
    );
  }

  const queueData = data as QueueData;
  const visibleJobs = queueData.jobs.filter((j) => !dismissed.has(j.slug) && j.status !== "done");
  const runningJobs = visibleJobs.filter((j) => j.status !== "queued" && j.status !== "error");
  const queuedJobs = visibleJobs.filter((j) => j.status === "queued");
  const errorJobs = visibleJobs.filter((j) => j.status === "error");
  const doneCount = queueData.jobs.filter((j) => j.status === "done").length;

  return (
    <PageLayout>
      {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
          <div>
            <h1 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>QUEUE MANAGER</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Monitor and manage all generation jobs</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="font-medium" style={{ color: "var(--accent)" }}>{queueData.stats.active}/{queueData.stats.maxConcurrent} active</span>
            <span className="font-medium" style={{ color: "var(--blue)" }}>{queueData.stats.queued}/{queueData.stats.maxQueue} queued</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass-card-static p-4 text-center">
            <div className="mb-1"><IconLightning size={28} /></div>
            <div className="text-xl font-bold" style={{ color: "var(--accent)" }}>{queueData.stats.active}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "var(--muted)" }}>Active</div>
          </div>
          <div className="glass-card-static p-4 text-center">
            <div className="mb-1"><IconClock size={28} /></div>
            <div className="text-xl font-bold" style={{ color: "var(--blue)" }}>{queueData.stats.queued}</div>
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
                <RunningJobCard
                  key={job.slug}
                  job={job}
                  onCancel={handleCancel}
                  onDismiss={handleDismiss}
                />
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
                    onClick={() => handleCancel(job.slug)}
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
                  onRetry={() => handleRetry(job.slug)}
                  onDismiss={() => handleDismiss(job.slug)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Queue Config */}
        <div className="mt-12 glass-card-static p-6">
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wide" style={{ color: "var(--ink)" }}>Configuration</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm" style={{ color: "var(--muted)" }}>
            <div>Max concurrent: <span className="font-bold" style={{ color: "var(--ink)" }}>{queueData.stats.maxConcurrent}</span></div>
            <div>Max queue size: <span className="font-bold" style={{ color: "var(--ink)" }}>{queueData.stats.maxQueue}</span></div>
            <div>Set via env: <span className="font-mono text-xs">ENCARTA_MAX_CONCURRENT</span></div>
            <div>Set via env: <span className="font-mono text-xs">ENCARTA_MAX_QUEUE</span></div>
          </div>
        </div>
    </PageLayout>
  );
}
