"use client";

import { useEffect, useState, useRef } from "react";
import GenerationBar, { type GeneratingEntry, phasePercent, phaseLabel } from "../components/GenerationBar";

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
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

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
      <div>
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3" style={{ background: "rgba(255,250,240,0.85)", backdropFilter: "blur(12px)", borderBottom: "3px solid var(--ink)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center text-[10px] text-white border-2 border-black shadow-[3px_3px_0_#1c1917]"
              style={{ background: "var(--orange)", fontFamily: "'Press Start 2P', monospace" }}>E-N</div>
            <a href="/" className="font-bold hidden sm:block hover:text-[#ea580c]" style={{ textDecoration: "none", color: "inherit" }}>Encarta-NG</a>
          </div>
          <a href="/" className="pixel-btn bg-[var(--ink)] text-white text-[9px] py-2">← HOME</a>
        </nav>
        <main className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#e0e0e0] border-t-[#1c1917] rounded-full"
            style={{ animation: "spin 0.8s linear infinite" }} />
          <p className="mt-4 text-[#888]">Connecting to queue...</p>
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
    <div>
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3" style={{ background: "rgba(255,250,240,0.85)", backdropFilter: "blur(12px)", borderBottom: "3px solid var(--ink)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center text-[10px] text-white border-2 border-black shadow-[3px_3px_0_#1c1917]"
            style={{ background: "var(--orange)", fontFamily: "'Press Start 2P', monospace" }}>E-N</div>
          <a href="/" className="font-bold hidden sm:block hover:text-[#ea580c]" style={{ textDecoration: "none", color: "inherit" }}>Encarta-NG</a>
        </div>
        <a href="/" className="pixel-btn bg-[var(--ink)] text-white text-[9px] py-2">← HOME</a>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="pixel text-xl" style={{ color: "var(--ink)" }}>QUEUE MANAGER</h1>
            <p className="text-sm text-[#888] mt-1">Monitor and manage all generation jobs</p>
          </div>
          <div className="flex gap-4 text-xs">
            <span style={{ color: "var(--orange)" }}>{data.stats.active}/{data.stats.maxConcurrent} active</span>
            <span style={{ color: "var(--blue)" }}>{data.stats.queued}/{data.stats.maxQueue} queued</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-3xl mb-1">⚡</div>
            <div className="pixel text-2xl" style={{ color: "var(--orange)" }}>{data.stats.active}</div>
            <div className="text-[10px] text-[#888] mt-1">ACTIVE</div>
          </div>
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-3xl mb-1">⏳</div>
            <div className="pixel text-2xl" style={{ color: "var(--blue)" }}>{data.stats.queued}</div>
            <div className="text-[10px] text-[#888] mt-1">QUEUED</div>
          </div>
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-3xl mb-1">✅</div>
            <div className="pixel text-2xl" style={{ color: "var(--green)" }}>{doneCount}</div>
            <div className="text-[10px] text-[#888] mt-1">DONE</div>
          </div>
          <div className="pixel-card-sm p-4 text-center bg-white">
            <div className="text-3xl mb-1">❌</div>
            <div className="pixel text-2xl" style={{ color: "var(--red)" }}>{errorJobs.length}</div>
            <div className="text-[10px] text-[#888] mt-1">ERRORS</div>
          </div>
        </div>

        {/* Active Jobs — inline GenerationBar */}
        <div className="mb-8">
          <div className="pixel-section-header bg-[#ea580c] text-white mb-4">ACTIVE</div>
          {activeJobs.length === 0 ? (
            <p className="text-sm text-[#aaa] p-4">No active jobs. Submit one from the home page or CLI.</p>
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
          <div className="pixel-section-header bg-[#0c4a6e] text-white mb-4">QUEUED</div>
          {queuedJobs.length === 0 ? (
            <p className="text-sm text-[#aaa] p-4">No queued jobs.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {queuedJobs.map((job) => (
                <div key={job.slug} className="pixel-card-sm p-3 bg-white flex items-center gap-3">
                  <span>⏳</span>
                  <span className="text-sm font-medium truncate flex-1">{job.title || job.slug}</span>
                  <span className="text-[10px] text-[#aaa]">{timeAgo(job.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Jobs */}
        {errorJobs.length > 0 && (
          <div className="mb-8">
            <div className="pixel-section-header bg-[#dc2626] text-white mb-4">ERRORS</div>
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

        {/* Queue Config Info */}
        <div className="pixel-card p-6 mt-12" style={{ background: "var(--cream)" }}>
          <h3 className="pixel text-[10px] mb-4" style={{ color: "var(--ink)" }}>CONFIGURATION</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-[#888]">Max concurrent:</span><span className="ml-2 font-bold">{data.stats.maxConcurrent}</span></div>
            <div><span className="text-[#888]">Max queue size:</span><span className="ml-2 font-bold">{data.stats.maxQueue}</span></div>
            <div><span className="text-[#888]">Set via env:</span><span className="ml-2 font-mono text-xs">ENCARTA_MAX_CONCURRENT</span></div>
            <div><span className="text-[#888]">Set via env:</span><span className="ml-2 font-mono text-xs">ENCARTA_MAX_QUEUE</span></div>
          </div>
        </div>
      </main>

      <footer className="border-t-4 border-black py-8" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="pixel text-[10px] opacity-60">ENCARTA-NG</p>
        </div>
      </footer>
    </div>
  );
}
