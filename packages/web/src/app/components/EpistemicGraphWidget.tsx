"use client";

import { useState } from "react";
import type { EpistemicGraphBlockData } from "@encarta/core";

export default function EpistemicGraphWidget({
  claimId,
  claimText,
  status = "verified",
  confidenceScore = 0.85,
  sources = [],
  counterEvidence = [],
}: EpistemicGraphBlockData) {
  const [showDetails, setShowDetails] = useState(false);

  const statusColors = {
    verified: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "VERIFIED CONSENSUS" },
    contested: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "CONTESTED CLAIM" },
    unverified: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", badge: "UNVERIFIED GAP" },
  };

  const statusKey = (status in statusColors ? status : "verified") as keyof typeof statusColors;
  const style = statusColors[statusKey];
  const pct = Math.round(confidenceScore * 100);

  return (
    <div className={`my-5 rounded-lg border ${style.border} ${style.bg} p-4 transition-all`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono font-bold tracking-wider ${style.text} bg-black/20 border ${style.border}`}>
          {style.badge}
        </span>
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--subtle)]">
          <span>Confidence:</span>
          <div className="h-2 w-16 rounded-full bg-[var(--border)] overflow-hidden">
            <div className="h-full bg-[var(--accent,#3b82f6)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-bold">{pct}%</span>
        </div>
      </div>

      <p className="text-sm font-medium text-[var(--foreground)] leading-relaxed mb-3">
        "{claimText}"
      </p>

      <div className="flex items-center justify-between text-xs text-[var(--subtle)] pt-2 border-t border-[var(--border)]/40">
        <span className="font-mono text-[11px]">Claim ID: {claimId}</span>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs font-medium text-[var(--accent,#3b82f6)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          {showDetails ? "Hide Evidence Graph ▲" : `Inspect Evidence (${sources.length} sources, ${counterEvidence.length} counters) ▼`}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]/50 space-y-3 text-xs">
          {/* Sources list */}
          {sources.length > 0 && (
            <div>
              <h5 className="font-mono text-[11px] font-bold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
                Supporting Sources ({sources.length})
              </h5>
              <ul className="space-y-1.5 pl-1">
                {sources.map((src: { title: string; url: string; excerpt?: string }, i: number) => (
                  <li key={i} className="flex flex-col gap-0.5 border-l-2 border-emerald-500/50 pl-2">
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent,#3b82f6)] hover:underline truncate">
                      {src.title} ↗
                    </a>
                    {src.excerpt && <p className="text-[11px] text-[var(--subtle)] italic font-mono">"{src.excerpt}"</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Counter Evidence list */}
          {counterEvidence.length > 0 && (
            <div>
              <h5 className="font-mono text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                Dissenting Counter-Evidence ({counterEvidence.length})
              </h5>
              <ul className="space-y-1.5 pl-1">
                {counterEvidence.map((ce: { description: string; sourceUrl?: string }, i: number) => (
                  <li key={i} className="border-l-2 border-amber-500/50 pl-2">
                    <p className="text-[11px] text-[var(--foreground)]">{ce.description}</p>
                    {ce.sourceUrl && (
                      <a href={ce.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent,#3b82f6)] hover:underline font-mono">
                        {ce.sourceUrl} ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
