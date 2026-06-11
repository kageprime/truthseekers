"use client";

import { useEffect, useState, useRef } from "react";

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

export default function QueueIndicator() {
  const [data, setData] = useState<QueueData | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${BASE}/queue`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // server not available
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open]);

  const total = (data?.stats?.active ?? 0) + (data?.stats?.queued ?? 0);
  const activeJobs = data?.jobs.filter((j) =>
    ["queued", "researching", "writing", "storing"].includes(j.status)
  ) ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="pixel text-[9px] px-3 py-3 sm:py-2 min-h-[44px] border-2 border-black shadow-[2px_2px_0_#1c1917] relative"
        style={{ background: total > 0 ? "var(--orange)" : "white", color: total > 0 ? "white" : "var(--ink)" }}
      >
        {total > 0 ? `⚡ ${total}` : "QUEUE"}
      </button>

      {open && (
        <div
          className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-[calc(100vw-32px)] sm:w-72 z-50"
          style={{ filter: "drop-shadow(4px 4px 0 rgba(28,25,23,0.15))" }}
        >
          <div className="pixel-card p-3 bg-white max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="pixel text-xs sm:text-[9px]" style={{ color: "var(--ink)" }}>
                GENERATION QUEUE
              </span>
              <span className="text-xs sm:text-[10px] text-[#888]">
                {data?.stats?.active ?? 0}/{data?.stats?.maxConcurrent ?? 3} active
              </span>
            </div>

            {activeJobs.length === 0 ? (
              <p className="text-xs text-[#aaa] py-2 text-center">Nothing generating.</p>
            ) : (
              <div className="space-y-1">
                {activeJobs.map((job) => (
                  <a
                    key={job.slug}
                    href={`/article/${job.slug}`}
                    className="flex items-center gap-2 px-2 py-1.5 border border-black/10 hover:bg-[var(--cream)] transition"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className="text-xs">
                      {job.status === "queued" ? "⏳" : job.status === "researching" ? "🔬" : job.status === "writing" ? "✍️" : job.status === "storing" ? "💾" : "⚡"}
                    </span>
                    <span className="text-xs font-medium truncate flex-1">{job.title || job.slug}</span>
                    <span className="pixel text-[9px] sm:text-[7px] text-[#888] uppercase">{job.status}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-dashed border-[#ddd] text-xs sm:text-[9px] text-[#888] text-center">
              Click a job to watch it live
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
