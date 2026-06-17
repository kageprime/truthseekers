"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { BASE } from "@/lib/constants";
import { IconClock, IconLightning, IconPencil, IconSearch, IconPalette, IconDatabase } from "./Icons";

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
    let backoff = 5000;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`${BASE}/queue`, { cache: "no-store" });
        if (res.status === 429) {
          backoff = Math.min(backoff * 2, 30000);
        } else {
          backoff = 5000;
          if (res.ok && !cancelled) {
            const json = await res.json();
            if (!cancelled) setData(json);
          }
        }
      } catch {
        // server not available
      }
      timer = setTimeout(poll, backoff);
    }

    poll();
    return () => { cancelled = true; clearTimeout(timer); };
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
    ["queued", "researching", "writing", "verifying", "media", "storing"].includes(j.status)
  ) ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn-icon btn-ghost text-xs font-medium relative"
        aria-label={`Queue: ${total} jobs`}
      >
        <IconClock size={16} />
        {total > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: "var(--accent)", color: "white" }}>{total}</span>}
      </button>

      {open && (
        <div
          className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-[calc(100vw-32px)] sm:w-72 z-50"
          style={{ filter: "drop-shadow(4px 4px 0 rgba(28,25,23,0.15))" }}
        >
          <div className="glass-card-static p-3 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold sm:text-[9px]" style={{ color: "var(--ink)" }}>
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
                  <Link
                    key={job.slug}
                    href={`/article/${job.slug}`}
                    className="flex items-center gap-2 px-2 py-1.5 border border-black/10 hover:bg-[var(--cream)] transition"
                    style={{ textDecoration: "none", color: "inherit" }}
                   
                  >
                    <span className="text-xs">
                      {job.status === "queued" ? <IconClock size={12} /> : job.status === "writing" ? <IconPencil size={12} /> : job.status === "verifying" ? <IconSearch size={12} /> : job.status === "media" ? <IconPalette size={12} /> : job.status === "storing" ? <IconDatabase size={12} /> : <IconLightning size={12} />}
                    </span>
                    <span className="text-xs font-medium truncate flex-1">{job.title || job.slug}</span>
                    <span className="text-xs font-medium sm:text-[7px] text-[#888] uppercase">{job.status}</span>
                  </Link>
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
