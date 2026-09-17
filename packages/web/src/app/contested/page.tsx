"use client";

import { useState } from "react";
import Link from "next/link";
import { useContestedClaims } from "../hooks";
import { useUiMode } from "../context/UiModeContext";
import ClaimDetailModal from "../components/article/ClaimDetailModal";
import type { ClaimItem } from "../components/article/GroupedClaimsList";

export default function ContestedPage() {
  const [limit, setLimit] = useState(50);
  const { data: res, loading } = useContestedClaims(limit);
  const { widthMode } = useUiMode();
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);

  const claims = ((res as any)?.claims as Array<{
    id: string;
    text: string;
    status: string;
    derived_confidence: number;
    article_slug?: string;
    confidence_vector?: Record<string, number>;
  }> | undefined) ?? [];

  const displayClaims = claims;

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-8 transition-all duration-300`}>
        {/* Header */}
        <div className="border-b border-zinc-200 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-[11px] uppercase tracking-wider border border-amber-200">
              Epistemic Fault Lines
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500 text-xs">Active Dispute Registry</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
            Contested Claims Registry
          </h1>

          <p className="font-serif text-base sm:text-lg text-zinc-600 italic leading-relaxed">
            A real-time public ledger of contradictory assertions across the encyclopedia, ranked by contradiction severity and counter-evidence volume.
          </p>
        </div>

        {/* Limit Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-700">
            <span>Display Limit:</span>
            {[10, 25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  limit === n
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
                aria-pressed={limit === n}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-zinc-500">
            {displayClaims.length} Contested Assertions Listed
          </span>
        </div>

        {/* List of Contested Claims */}
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-500">Loading contested claims…</div>
        ) : displayClaims.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
            No contested claims recorded yet. Generate articles to populate the registry.
          </div>
        ) : (
        <div className="rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden bg-white shadow-xs">
          {displayClaims.map((claim, idx) => {
            const contraLevel = claim.confidence_vector?.contradiction_level ?? 0.75;
            const contraPct = Math.round(contraLevel * 100);

            return (
              <div
                key={claim.id || idx}
                onClick={() =>
                  setSelectedClaim({
                    id: claim.id,
                    text: claim.text,
                    status: "contested",
                    derived_confidence: claim.derived_confidence,
                    contradiction_level: contraLevel,
                  })
                }
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">
                      {claim.text}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                      {claim.article_slug && (
                        <Link
                          href={`/article/${claim.article_slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-900 font-medium"
                        >
                          Topic: {claim.article_slug.replace(/-/g, " ")}
                        </Link>
                      )}
                      <span>·</span>
                      <span className="font-mono text-zinc-600">
                        {Math.round(claim.derived_confidence * 100)}% Conf
                      </span>
                    </div>

                    {/* Contradiction Bar */}
                    <div className="flex items-center gap-2 pt-1 text-xs text-zinc-500 max-w-sm">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
                        Dispute:
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-600"
                          style={{ width: `${contraPct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-amber-800 font-bold">
                        {contraPct}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center shrink-0">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    Contested
                  </span>
                  <span className="text-zinc-400 text-lg font-light group-hover:text-zinc-700 transition-colors">
                    ›
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Claim Modal */}
      <ClaimDetailModal
        claim={selectedClaim}
        onClose={() => setSelectedClaim(null)}
      />
    </div>
  );
}
