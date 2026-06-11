"use client";

import { useEffect, useState } from "react";
import GenerationBar, { type GeneratingEntry } from "../components/GenerationBar";
import TruthseekersLogo from "../components/TruthseekersLogo";
import QueueIndicator from "../components/QueueIndicator";

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
      <div className="min-h-screen flex flex-col bg-[#fffaf0]">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5]">
          <TruthseekersLogo />
        </nav>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#e0e0e0] border-t-[#1a1a1a] rounded-full"
              style={{ animation: "spin 0.8s linear infinite" }} />
            <p className="mt-4 text-[#5f6368]">Connecting to queue...</p>
          </div>
        </main>
      </div>
    );
  }

  const visibleJobs = data.jobs.filter((j) => !dismissed.has(j.slug) && j.status !== "done");
  const activeJobs = visibleJobs.filter((j) => j.status !== "queued" && j.status !== "error");
  const queuedJobs = visibleJobs.filter((j) => j.status === "queued");
  const errorJobs = visibleJobs.filter((j) => j.status === "error");
  const doneCount = data.jobs.filter((j) => j.status === "done").length;

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5]">
        <TruthseekersLogo />
        <div className="flex items-center gap-3 sm:gap-6 text-sm text-[#5f6368]">
          <a href="/" className="hover:text-[#1a1a1a] hover:underline">Home</a>
          <a href="/article/new" className="hover:text-[#1a1a1a] hover:underline">New Article</a>
          <QueueIndicator />
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">Queue Manager</h1>
            <p className="text-sm text-[#5f6368] mt-1">Monitor and manage all generation jobs</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-[#ea580c] font-medium">{data.stats.active}/{data.stats.maxConcurrent} active</span>
            <span className="text-[#0c4a6e] font-medium">{data.stats.queued}/{data.stats.maxQueue} queued</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg border border-[#dfe1e5] text-center bg-white hover:shadow-sm transition-shadow">
            <div className="text-3xl mb-1">⚡</div>
            <div className="text-2xl font-bold text-[#ea580c]">{data.stats.active}</div>
            <div className="text-xs text-[#5f6368] mt-1 uppercase tracking-wide">Active</div>
          </div>
          <div className="p-4 rounded-lg border border-[#dfe1e5] text-center bg-white hover:shadow-sm transition-shadow">
            <div className="text-3xl mb-1">⏳</div>
            <div className="text-2xl font-bold text-[#0c4a6e]">{data.stats.queued}</div>
            <div className="text-xs text-[#5f6368] mt-1 uppercase tracking-wide">Queued</div>
          </div>
          <div className="p-4 rounded-lg border border-[#dfe1e5] text-center bg-white hover:shadow-sm transition-shadow">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-2xl font-bold text-[#22c55e]">{doneCount}</div>
            <div className="text-xs text-[#5f6368] mt-1 uppercase tracking-wide">Done</div>
          </div>
          <div className="p-4 rounded-lg border border-[#dfe1e5] text-center bg-white hover:shadow-sm transition-shadow">
            <div className="text-3xl mb-1">❌</div>
            <div className="text-2xl font-bold text-[#dc2626]">{errorJobs.length}</div>
            <div className="text-xs text-[#5f6368] mt-1 uppercase tracking-wide">Errors</div>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4 pb-2 border-b border-[#dfe1e5]">Active</h2>
          {activeJobs.length === 0 ? (
            <p className="text-sm text-[#9aa0a6] py-4">No active jobs. Submit one from the home page or CLI.</p>
          ) : (
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <GenerationBar
                  key={job.slug}
                  entry={jobToEntry(job)}
                  showWatchLive={true}
                  onRetry={() => {}}
                  onDismiss={() => {
                    dismissed.add(job.slug);
                    setDismissed(new Set(dismissed));
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Queued Jobs */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4 pb-2 border-b border-[#dfe1e5]">Queued</h2>
          {queuedJobs.length === 0 ? (
            <p className="text-sm text-[#9aa0a6] py-4">No queued jobs.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {queuedJobs.map((job) => (
                <div key={job.slug} className="flex items-center gap-3 p-3 rounded-lg border border-[#dfe1e5] bg-white hover:bg-[#f8f9fa] transition-colors">
                  <span className="text-lg">⏳</span>
                  <span className="text-sm font-medium truncate flex-1 text-[#1a1a1a]">{job.title || job.slug}</span>
                  <span className="text-xs text-[#9aa0a6]">{timeAgo(job.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Jobs */}
        {errorJobs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[#dc2626] mb-4 pb-2 border-b border-[#dfe1e5]">Errors</h2>
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
                    dismissed.add(job.slug);
                    setDismissed(new Set(dismissed));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Queue Config */}
        <div className="mt-12 p-6 rounded-lg border border-[#dfe1e5] bg-[#f8f9fa]">
          <h3 className="text-xs font-semibold text-[#1a1a1a] mb-4 uppercase tracking-wide">Configuration</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-[#5f6368]">
            <div>Max concurrent: <span className="font-bold text-[#1a1a1a]">{data.stats.maxConcurrent}</span></div>
            <div>Max queue size: <span className="font-bold text-[#1a1a1a]">{data.stats.maxQueue}</span></div>
            <div>Set via env: <span className="font-mono text-xs">ENCARTA_MAX_CONCURRENT</span></div>
            <div>Set via env: <span className="font-mono text-xs">ENCARTA_MAX_QUEUE</span></div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#dadce0] py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-[#5f6368]">
          <span className="font-medium text-[#1a1a1a]">Truthseekers</span>
          <span className="text-xs">AI-powered encyclopedia</span>
        </div>
      </footer>
    </div>
  );
}
