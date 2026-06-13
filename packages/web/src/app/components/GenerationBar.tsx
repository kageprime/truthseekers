"use client";

import { useState, useEffect, useRef } from "react";
import ProcessViewer from "./ProcessViewer";
import type { AgentEvent } from "./ProcessViewer";

export interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

interface PhaseInfo {
  phase: string;
  label: string;
  time: string;
  completed: boolean;
}

const PHASE_CHECKPOINTS: Record<string, number> = {
  queued: 5,
  starting: 5,
  research: 20,
  researching: 20,
  outline: 40,
  write: 60,
  writing: 60,
  verify: 75,
  verifying: 75,
  correcting: 80,
  "generate-media": 90,
  media: 90,
  "generating-images": 93,
  store: 95,
  storing: 95,
  complete: 100,
  done: 100,
  error: 0,
};

export function phasePercent(phase: string): number {
  return PHASE_CHECKPOINTS[phase] ?? 10;
}

export function phaseLabel(phase: string): string {
  const m: Record<string, string> = {
    queued: "QUEUED", researching: "RESEARCHING", outline: "OUTLINING",
    write: "WRITING", verifying: "VERIFYING", correcting: "CORRECTING",
    media: "GENERATING MEDIA", storing: "STORING", complete: "DONE", done: "DONE",
    error: "ERROR",
  };
  return m[phase] ?? phase.toUpperCase();
}

function buildPhaseTimeline(currentPhase: string): PhaseInfo[] {
  const phases = ["queued", "researching", "outline", "write", "verifying", "media", "storing", "done"];
  const currentIdx = phases.indexOf(currentPhase);
  return phases.map((p, i) => ({
    phase: p,
    label: phaseLabel(p),
    time: currentIdx >= i ? "✓" : "",
    completed: currentIdx > i,
  }));
}

function nextCheckpoint(current: string): number {
  const order = ["queued", "researching", "outline", "write", "verifying", "media", "storing"];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return 99;
  return PHASE_CHECKPOINTS[order[idx + 1]];
}

export default function GenerationBar({
  entry,
  onRetry,
  onDismiss,
  showWatchLive = true,
}: {
  entry: GeneratingEntry;
  onRetry: (slug: string) => void;
  onDismiss: (slug: string) => void;
  showWatchLive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [smoothPct, setSmoothPct] = useState(5);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const targetPct = phasePercent(entry.phase);
  const label = phaseLabel(entry.phase);
  const isDone = entry.phase === "done" || entry.phase === "complete";
  const isError = entry.phase === "error";
  const timeline = buildPhaseTimeline(entry.phase);

  // Smooth animation: creep toward target between checkpoints
  useEffect(() => {
    setSmoothPct((prev) => {
      if (targetPct > prev) return prev; // jump forward on phase change
      return prev;
    });

    const creepTarget = nextCheckpoint(entry.phase);
    const startTime = Date.now();
    const startPct = targetPct;

    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const duration = 8000; // 8 seconds to creep to next checkpoint
      const progress = Math.min(elapsed / duration, 1);
      const current = startPct + (creepTarget - startPct) * progress;

      setSmoothPct(Math.min(current, 99));

      if (progress < 1 && entry.phase !== "done" && entry.phase !== "error") {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [entry.phase, targetPct]);

  // Snap to 100% when done
  useEffect(() => {
    if (isDone) setSmoothPct(100);
  }, [isDone]);

  const displayPct = isDone ? 100 : Math.round(smoothPct);
  const barColor = isDone ? "var(--green)" : isError ? "var(--red)" : "var(--orange)";
  const icon = isDone ? "✅" : isError ? "⚠️" : "⚡";

  return (
    <div
      className={`pixel-card-sm bg-white ${expanded ? "" : "cursor-pointer"}`}
      style={{ transition: "all 0.2s ease-out" }}
    >
      {/* Minimized bar */}
      <div
        className="p-3 flex items-center gap-3"
        onClick={() => !isDone && !isError && setExpanded(!expanded)}
      >
        <span className="text-lg shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm truncate">{entry.title}</span>
            <span className="pixel text-xs sm:text-[9px] shrink-0 ml-2" style={{ color: barColor }}>
              {label} {!isDone && !isError ? `${displayPct}%` : ""}
            </span>
          </div>
          {!isDone && !isError && !expanded && (
            <div className="w-full h-2 border border-black bg-white overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${displayPct}%`, background: barColor, transition: "width 0.3s linear" }}
              />
            </div>
          )}
          {isDone && (
            <div className="w-full h-2 border border-black bg-white overflow-hidden">
              <div className="h-full" style={{ width: "100%", background: barColor }} />
            </div>
          )}
        </div>
        {isDone && (
          <a
            href={`/article/${entry.slug}`}
            className="btn-primary btn-sm shrink-0"
            data-color="green"
          >
            VIEW
          </a>
        )}
        {isError && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(entry.slug); }}
            className="btn-primary btn-sm shrink-0"
            data-color="red"
          >
            RETRY
          </button>
        )}
        {!isDone && !isError && showWatchLive && (
          <a
            href={`/generate/${entry.slug}`}
            className="btn-primary btn-sm shrink-0"
            data-color="blue"
            onClick={(e) => e.stopPropagation()}
          >
            LIVE
          </a>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(entry.slug); }}
          className="btn-ghost shrink-0"
          style={{ minWidth: "44px", minHeight: "44px" }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Expanded details */}
      {expanded && !isDone && !isError && (
        <div className="px-4 pb-4 border-t-2 border-dashed border-[#e0e0e0] pt-3">
          {/* Progress bar (larger in expanded view) */}
          <div className="w-full h-4 border-2 border-black mb-3 bg-white overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${displayPct}%`, background: barColor, transition: "width 0.3s linear" }}
            />
          </div>

          {/* Phase timeline */}
          <div className="space-y-2">
            {timeline.map((p) => (
              <div key={p.phase} className="flex items-center gap-3 text-xs">
                <span className="w-5 text-center">
                  {p.completed ? "✅" : entry.phase === p.phase ? "⏳" : "⬜"}
                </span>
                <span
                  className="font-semibold"
                  style={{
                    color: entry.phase === p.phase ? barColor : p.completed ? "var(--green)" : "#aaa",
                  }}
                >
                  {p.label}
                </span>
                <span className="text-[#aaa] ml-auto">{p.time}</span>
              </div>
            ))}
          </div>

          {showWatchLive && (
            <div className="mt-3 flex gap-2">
              <a
                href={`/generate/${entry.slug}`}
                className="btn-primary btn-sm"
                data-color="blue"
              >
                WATCH LIVE →
              </a>
            </div>
          )}

          {/* Agent activity stream */}
          {entry.agentEvents && entry.agentEvents.length > 0 && (
            <ProcessViewer events={entry.agentEvents} />
          )}
        </div>
      )}

      {/* Error details */}
      {expanded && isError && (
        <div className="px-4 pb-4 border-t-2 border-dashed border-[#e0e0e0] pt-3">
          <p className="text-xs text-[var(--red)] mb-2">{entry.error}</p>
          <button
            onClick={() => onRetry(entry.slug)}
            className="btn-primary btn-sm"
          >
            RETRY GENERATION
          </button>
        </div>
      )}
    </div>
  );
}
