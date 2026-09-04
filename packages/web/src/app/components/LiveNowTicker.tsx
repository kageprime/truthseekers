"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveNow } from "../hooks/useLive";

const PHASE_LABEL: Record<string, string> = {
  retrieve: "researching",
  extract_claims: "extracting claims",
  map_evidence: "mapping evidence",
  critique: "critiquing",
  detect_missing: "finding gaps",
  map_language: "mapping language",
  scrutinize: "scrutinizing",
  resolve: "resolving",
  generate_article: "writing",
  complete: "published",
  queued: "queued",
};

function phaseLabel(phase: string): string {
  return PHASE_LABEL[phase] ?? phase.replace(/_/g, " ");
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "article_complete":
      return "JUST IN";
    case "progress":
      return "NOW";
    case "agent_event":
      return "TOOL";
    default:
      return "LIVE";
  }
}

function titleize(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function timeAgo(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

/**
 * Slim global ticker. Sits at the top of the shell above the page content.
 * Streams /live/now and rotates through the most recent activity.
 */
export default function LiveNowTicker() {
  const items = useLiveNow();
  const [index, setIndex] = useState(0);
  const [recentCount, setRecentCount] = useState(0);

  useEffect(() => {
    setRecentCount((c) => c + 1);
    const t = setTimeout(() => setRecentCount((c) => Math.max(0, c - 1)), 4000);
    return () => clearTimeout(t);
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div
        className="w-full text-[11px] tracking-wide flex items-center gap-2 px-4 py-1"
        style={{ background: "var(--surface-elevated)", color: "var(--subtle)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--subtle)" }} />
        <span style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>No activity yet</span>
      </div>
    );
  }

  const current = items[Math.min(index, items.length - 1)];

  return (
    <div
      className="w-full text-[11px] tracking-wide flex items-center gap-2 px-4 py-1 overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        color: "var(--muted)",
        borderBottom: "1px solid var(--border)",
        transition: "background 400ms ease",
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: recentCount > 0 ? "#dc2626" : "var(--subtle)",
          animation: recentCount > 0 ? "tickerPulse 1.2s ease-out infinite" : "none",
        }}
      />
      <span
        className="font-semibold shrink-0"
        style={{ letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)" }}
      >
        Live
      </span>
      <span style={{ color: "var(--subtle)" }}>·</span>
      <span
        className="font-medium shrink-0"
        style={{ letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold, #b08a4a)" }}
      >
        {kindLabel(current.kind)}
      </span>
      <Link
        href={`/article/${current.slug}`}
        className="truncate hover:underline"
        style={{ color: "var(--ink)", fontWeight: 500 }}
      >
        {titleize(current.slug)}
        <span style={{ color: "var(--subtle)" }}> — {phaseLabel(current.phase)}</span>
      </Link>
      <span className="ml-auto shrink-0" style={{ color: "var(--subtle)" }}>
        {timeAgo(current.at)} ago
        {items.length > 1 && (
          <>
            <span style={{ color: "var(--subtle)" }}> · </span>
            <span>{items.length} events</span>
          </>
        )}
      </span>
      <style>{`
        @keyframes tickerPulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          70%  { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  );
}
