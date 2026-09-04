"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import PhaseTimeline from "./PhaseTimeline";
import type { AgentEvent } from "./ProcessViewer";
import { IconLightning, IconCheckCircle, IconAlert } from "./Icons";
import { useResolveArticle } from "../hooks";

export interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

const PHASE_CHECKPOINTS: Record<string, number> = {
  queued: 5, starting: 5, research: 20, researching: 20, outline: 40,
  write: 60, writing: 60, verify: 75, verifying: 75, correcting: 80,
  "generate-media": 90, media: 90, "generating-images": 93, store: 95, storing: 95,
  complete: 100, done: 100, error: 0, paused: 75,
};

function phasePercent(phase: string): number {
  return PHASE_CHECKPOINTS[phase] ?? 10;
}

function phaseLabel(phase: string): string {
  const m: Record<string, string> = {
    queued: "QUEUED", researching: "RESEARCHING", outline: "OUTLINING",
    write: "WRITING", verifying: "VERIFYING", correcting: "CORRECTING",
    media: "GENERATING MEDIA", storing: "STORING", complete: "DONE", done: "DONE", error: "ERROR",
    paused: "PAUSED FOR REVIEW",
  };
  return m[phase] ?? phase.toUpperCase();
}

function nextCheckpoint(current: string): number {
  const order = ["queued", "researching", "outline", "write", "verifying", "media", "storing"];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return 99;
  return PHASE_CHECKPOINTS[order[idx + 1]];
}

export { phasePercent, phaseLabel };

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
  const [expanded, setExpanded] = useState(true);
  const [smoothPct, setSmoothPct] = useState(5);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const { mutate: resolveMutation } = useResolveArticle();

  const targetPct = phasePercent(entry.phase);
  const label = phaseLabel(entry.phase);
  const isDone = entry.phase === "done" || entry.phase === "complete";
  const isError = entry.phase === "error";
  const isPaused = entry.phase === "paused";
  const [resolving, setResolving] = useState(false);

  let verifyData: { confidenceScore?: number; issues?: { section: string; claim: string; issue: string; severity: string }[] } | null = null;
  if (isPaused && entry.error) {
    try {
      verifyData = JSON.parse(entry.error);
    } catch {}
  }

  async function handleResolve(action: "approve" | "correct") {
    setResolving(true);
    try {
      await resolveMutation({ slug: entry.slug, action });
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(false);
    }
  }

  // Auto-expand when generation starts
  useEffect(() => {
    if (entry.phase !== "done" && entry.phase !== "error" && entry.phase !== "queued") {
      setExpanded(true);
    }
  }, [entry.phase]);

  // Smooth animation: creep toward target between checkpoints
  useEffect(() => {
    setSmoothPct((prev) => (targetPct > prev ? targetPct : prev));

    const creepTarget = nextCheckpoint(entry.phase);
    const startTime = Date.now();
    const startPct = targetPct;

    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const duration = 8000;
      const progress = Math.min(elapsed / duration, 1);
      const current = startPct + (creepTarget - startPct) * progress;
      setSmoothPct(Math.min(current, 99));
      if (progress < 1 && entry.phase !== "done" && entry.phase !== "error" && entry.phase !== "paused") {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [entry.phase, targetPct]);

  useEffect(() => { if (isDone) setSmoothPct(100); }, [isDone]);

  const displayPct = isDone ? 100 : Math.round(smoothPct);
  const barColor = isDone ? "var(--green)" : isError ? "var(--red)" : isPaused ? "var(--gold)" : "var(--accent)";
  const StatusIcon = isDone ? IconCheckCircle : isError ? IconAlert : isPaused ? IconAlert : IconLightning;

  return (
    <div className="glass-card-static" style={{ transition: "all 0.2s ease-out" }}>
      {/* Minimized header bar */}
      <div
        className="p-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="shrink-0">{typeof StatusIcon === "function" ? <StatusIcon size={20} /> : StatusIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm truncate">{entry.title}</span>
            <span className="text-xs font-semibold sm:text-[9px] shrink-0 ml-2" style={{ color: barColor }}>
              {isDone ? "DONE" : isError ? "ERROR" : `${label} ${displayPct}%`}
            </span>
          </div>
          <div className="w-full h-2 border border-[var(--border)] bg-[var(--surface-elevated)] overflow-hidden">
            <div className="h-full" style={{ width: `${displayPct}%`, background: barColor, transition: "width 0.3s linear" }} />
          </div>
        </div>
        {isDone && (
          <Link href={`/article/${entry.slug}`} className="btn btn-primary btn btn-sm shrink-0" data-color="green" onClick={(e) => e.stopPropagation()}>VIEW</Link>
        )}
        {isError && (
          <button onClick={(e) => { e.stopPropagation(); onRetry(entry.slug); }} className="btn btn-primary btn btn-sm shrink-0" data-color="red">RETRY</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDismiss(entry.slug); }} className="btn-ghost shrink-0" style={{ minWidth: "44px", minHeight: "44px" }} title="Dismiss">✕</button>
      </div>

      {/* Expanded live view */}
      {expanded && (
        <div className="border-t-2" style={{ borderColor: "var(--border)" }}>
          {/* Phase Timeline */}
          <div className="px-4 pt-3 pb-2">
            <PhaseTimeline currentPhase={entry.phase} />
          </div>

          {/* Paused human-in-the-loop review */}
          {isPaused && (
            <div className="px-4 pb-4 pt-2" style={{ background: "color-mix(in srgb, var(--accent-bg) 50%, transparent)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <h3 className="text-xs font-bold" style={{ color: "var(--ink)" }}>Verification Issues Detected</h3>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                    The agent's verification scan found conflicting sources or accuracy issues.
                  </p>
                </div>
              </div>

              {verifyData && (
                <div className="space-y-2 mb-4 p-2.5 rounded border max-h-48 overflow-y-auto" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between text-[10px] border-b pb-1.5 mb-1.5" style={{ borderColor: "var(--border)" }}>
                    <span className="font-semibold text-gray-700" style={{ color: "var(--muted)" }}>Confidence Score</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[9px]"
                      style={{
                        background: verifyData.confidenceScore && verifyData.confidenceScore >= 0.8
                          ? "var(--badge-success-bg)" : verifyData.confidenceScore && verifyData.confidenceScore >= 0.5
                          ? "var(--badge-warning-bg)" : "var(--badge-error-bg)",
                        color: verifyData.confidenceScore && verifyData.confidenceScore >= 0.8
                          ? "var(--badge-success-text)" : verifyData.confidenceScore && verifyData.confidenceScore >= 0.5
                          ? "var(--badge-warning-text)" : "var(--badge-error-text)",
                      }}>
                      {verifyData.confidenceScore ? Math.round(verifyData.confidenceScore * 100) : 0}%
                    </span>
                  </div>

                  {verifyData.issues && verifyData.issues.length > 0 ? (
                    <div className="space-y-2">
                      {verifyData.issues.map((issue, idx) => (
                        <div key={idx} className="text-[10px] border-l-2 pl-2" style={{ borderColor: "var(--accent)" }}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold" style={{ color: "var(--ink)" }}>[{issue.section || "General"}]</span>
                            <span className="text-[8px] font-bold px-1 uppercase rounded"
                              style={{
                                background: issue.severity === "high"
                                  ? "var(--badge-error-bg)" : issue.severity === "medium"
                                  ? "var(--badge-warning-bg)" : "var(--badge-info-bg)",
                                color: issue.severity === "high"
                                  ? "var(--badge-error-text)" : issue.severity === "medium"
                                  ? "var(--badge-warning-text)" : "var(--badge-info-text)",
                              }}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="mt-0.5" style={{ color: "var(--muted)" }}><strong style={{ color: "var(--ink)" }}>Claim:</strong> {issue.claim}</p>
                          <p className="mt-0.5" style={{ color: "var(--muted)" }}><strong style={{ color: "var(--ink)" }}>Issue:</strong> {issue.issue}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] italic" style={{ color: "var(--subtle)" }}>No specific issues listed.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  disabled={resolving}
                  onClick={() => handleResolve("approve")}
                  className="btn btn-primary btn-sm"
                  style={{ background: "var(--green)", color: "var(--surface)", border: "none" }}
                >
                  {resolving ? "Processing..." : "Approve & Publish"}
                </button>
                <button
                  disabled={resolving}
                  onClick={() => handleResolve("correct")}
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  {resolving ? "Processing..." : "Fix Issues (Agent Correction)"}
                </button>
              </div>
            </div>
          )}

          {/* Agent activity runs in the Truth Console panel — not inline */}

          {/* Error detail */}
          {isError && (
            <div className="px-4 pb-4 pt-2">
              <p className="text-xs text-[var(--red)] mb-2">{entry.error || "Unknown error"}</p>
              <button onClick={() => onRetry(entry.slug)} className="btn btn-primary btn btn-sm" data-color="red">RETRY GENERATION</button>
            </div>
          )}

          {/* Done celebration */}
          {isDone && (
            <div className="done-banner-inline">
              <div className="done-icon">🎉</div>
              <h2>Article Complete</h2>
              <p>The encyclopedia has a new entry on <strong>{entry.title}</strong>.</p>
              <div className="done-actions">
                <Link href={`/article/${entry.slug}`} className="btn btn-primary">Read Article</Link>
                <button onClick={() => onRetry(entry.slug)} className="btn btn-secondary">Regenerate</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
