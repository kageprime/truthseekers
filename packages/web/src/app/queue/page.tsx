"use client";

import { useEffect, useState } from "react";
import GenerationBar, { type GeneratingEntry } from "../components/GenerationBar";
import PageLayout from "../components/PageLayout";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097";

interface QueueJob {
  slug: string;
  title?: string;
  status: string;
  phase: string;
  createdAt: string;
  error?: string;
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
  };
}

export default function QueuePage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${BASE}/queue`);
        if (!cancelled && res.ok) {
          const json: QueueData = await res.json();
          setData(json);
        }
      } catch { /* server may be down */ }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!data) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#e0e0e0] border-t-[#1a1a1a] rounded-full"
              style={{ animation: "spin 0.8s linear infinite" }} />
            <p className="mt-4 text-sm" style={{ color: "#5f6368" }}>Connecting to queue...</p>
          </div>
        </main>
      </PageLayout>
    );
  }

  const visibleJobs = data.jobs.filter((j) => !dismissed.has(j.slug) && j.status !== "done");
  const activeJobs = visibleJobs.filter((j) => j.status !== "queued" && j.status !== "error");
  const queuedJobs = visibleJobs.filter((j) => j.status === "queued");
  const errorJobs = visibleJobs.filter((j) => j.status === "error");
  const doneCount = data.jobs.filter((j) => j.status === "done").length;

  return (
    <PageLayout>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
          <div>
            <h1 className="pixel text-sm" style={{ color: "var(--ink)" }}>QUEUE MANAGER</h1>
            <p className="text-sm mt-1" style={{ color: "#5f6368" }}>Monitor and manage all generation jobs</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="font-medium" style={{ color: "var(--orange)" }}>{data.stats.active}/{data.stats.maxConcurrent} active</span>
            <span className="font-medium" style={{ color: "var(--blue)" }}>{data.stats.queued}/{data.stats.maxQueue} queued</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-xl font-bold" style={{ color: "var(--orange)" }}>{data.stats.active}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "#5f6368" }}>Active</div>
          </div>
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-2xl mb-1">⏳</div>
            <div className="text-xl font-bold" style={{ color: "var(--blue)" }}>{data.stats.queued}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "#5f6368" }}>Queued</div>
          </div>
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-xl font-bold" style={{ color: "var(--green)" }}>{doneCount}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "#5f6368" }}>Done</div>
          </div>
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-2xl mb-1">❌</div>
            <div className="text-xl font-bold" style={{ color: "var(--red)" }}>{errorJobs.length}</div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: "#5f6368" }}>Errors</div>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xl">⚡</span>
            <div>
              <h2 className="pixel text-xs" style={{ color: "var(--ink)" }}>ACTIVE JOBS</h2>
              <div className="h-1 w-10 mt-1" style={{ background: "var(--orange)" }} />
            </div>
          </div>
          {activeJobs.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "#9aa0a6" }}>No active jobs. Submit one from the home page or CLI.</p>
          ) : (
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <GenerationBar
                  key={job.slug}
                  entry={jobToEntry(job)}
                  showWatchLive={true}
                  onRetry={() => {}}
                  onDismiss={() => {
                    setDismissed((prev) => new Set(prev).add(job.slug));
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Queued Jobs */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xl">⏳</span>
            <div>
              <h2 className="pixel text-xs" style={{ color: "var(--ink)" }}>QUEUED JOBS</h2>
              <div className="h-1 w-10 mt-1" style={{ background: "var(--blue)" }} />
            </div>
          </div>
          {queuedJobs.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "#9aa0a6" }}>No queued jobs.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {queuedJobs.map((job) => (
                <div key={job.slug} className="flex items-center gap-3 p-3 pixel-card-sm bg-white">
                  <span className="text-lg">⏳</span>
                  <span className="text-sm font-medium truncate flex-1" style={{ color: "#1a1a1a" }}>{job.title || job.slug}</span>
                  <span className="text-xs" style={{ color: "#9aa0a6" }}>{timeAgo(job.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Jobs */}
        {errorJobs.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xl">❌</span>
              <div>
                <h2 className="pixel text-xs" style={{ color: "var(--red)" }}>ERRORS</h2>
                <div className="h-1 w-10 mt-1" style={{ background: "var(--red)" }} />
              </div>
            </div>
            <div className="space-y-2">
              {errorJobs.map((job) => (
                <GenerationBar
                  key={job.slug}
                  entry={jobToEntry(job)}
                  showWatchLive={false}
                  onRetry={() => {
                    fetch(`${BASE}/articles/${job.slug}/generate`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ persona: "veritas" }),
                    });
                  }}
                  onDismiss={() => {
                    setDismissed((prev) => new Set(prev).add(job.slug));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Queue Config */}
        <div className="mt-12 pixel-card-sm p-6" style={{ background: "#f8f9fa" }}>
          <h3 className="pixel text-xs mb-4 uppercase tracking-wide" style={{ color: "var(--ink)" }}>Configuration</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm" style={{ color: "#5f6368" }}>
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
