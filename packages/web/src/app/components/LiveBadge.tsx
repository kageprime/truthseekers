"use client";

import { useLiveArticle } from "../hooks/useLive";

const PHASE_LABEL: Record<string, string> = {
  retrieve: "Researching sources",
  extract_claims: "Extracting claims",
  map_evidence: "Mapping evidence",
  critique: "Critiquing",
  detect_missing: "Detecting gaps",
  map_language: "Mapping language",
  scrutinize: "Scrutinizing",
  resolve: "Resolving contradictions",
  generate_article: "Writing article",
  complete: "Published",
  queued: "Queued",
  running: "Running",
  provisioning: "Provisioning",
};

function phaseLabel(phase: string): string {
  return PHASE_LABEL[phase] ?? phase.replace(/_/g, " ");
}

function timeSince(iso: string): string {
  if (!iso) return "";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

export default function LiveBadge({ slug, title }: { slug: string; title?: string }) {
  const live = useLiveArticle(slug);
  if (!live) return null;

  const isLive = live.live;
  const isRunning = live.phase && !["complete", "done"].includes(live.phase) && live.viewers >= 0;

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide"
      style={{
        background: isLive ? "rgba(220, 38, 38, 0.08)" : "var(--surface-elevated)",
        color: isLive ? "var(--accent)" : "var(--muted)",
        border: `1px solid ${isLive ? "rgba(220, 38, 38, 0.35)" : "var(--border)"}`,
        transition: "all 250ms ease",
      }}
      aria-live="polite"
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 8,
          height: 8,
          background: isLive ? "#dc2626" : "var(--subtle)",
          boxShadow: isLive ? "0 0 0 0 rgba(220,38,38,0.7)" : "none",
          animation: isLive ? "livePulse 1.6s ease-out infinite" : "none",
        }}
      />
      <span style={{ letterSpacing: "0.08em" }}>{isLive ? "LIVE" : "UPDATED"}</span>
      {isLive && isRunning && live.phase && (
        <>
          <span style={{ color: "var(--subtle)" }}>·</span>
          <span style={{ color: "var(--ink)" }}>{phaseLabel(live.phase)}</span>
        </>
      )}
      {live.viewers > 0 && (
        <>
          <span style={{ color: "var(--subtle)" }}>·</span>
          <span>{live.viewers} {live.viewers === 1 ? "reading" : "reading"}</span>
        </>
      )}
      {!isLive && live.lastEventAt && (
        <>
          <span style={{ color: "var(--subtle)" }}>·</span>
          <span>{timeSince(live.lastEventAt)}</span>
        </>
      )}
      <style>{`
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          70%  { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  );
}
