"use client";

import { useState } from "react";
import Link from "next/link";
import { useContestedClaims } from "../hooks";
import { useUiMode } from "../context/UiModeContext";
import PlateHead from "../components/PlateHead";
import ClaimDetailRail from "../components/article/ClaimDetailRail";
import type { ClaimItem } from "../components/article/GroupedClaimsList";

export default function ContestedPage() {
  const [limit, setLimit] = useState(50);
  const { data: res, loading } = useContestedClaims(limit);
  const { containerClass } = useUiMode();
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

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass("standard")} transition-all duration-300`}>
        <PlateHead
          folioLeft="Ranked by contradiction"
          folioRight={`${displayClaims.length} listed`}
          title="Contested claims"
          deck="Contradictory assertions across the encyclopedia, ranked by contradiction severity and counter-evidence volume."
        />

        <div className="flex items-center justify-between gap-4 flex-wrap py-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <span className="font-mono uppercase tracking-[0.14em] text-subtle">Show</span>
            {[10, 25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-2 py-0.5 font-mono tabular-nums cursor-pointer transition-colors ${
                  limit === n
                    ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                    : "text-subtle hover:text-ink"
                }`}
                aria-pressed={limit === n}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-subtle tabular-nums">
            {displayClaims.length} listed
          </span>
        </div>

        {loading ? (
          <p className="font-serif italic text-muted py-16 text-center">Loading contested claims…</p>
        ) : displayClaims.length === 0 ? (
          <p className="font-serif italic text-muted py-16 text-center">
            No contested claims recorded yet. Generate articles to populate the registry.
          </p>
        ) : (
          <div className="ledger">
            {displayClaims.map((claim, idx) => {
              const contraLevel = claim.confidence_vector?.contradiction_level ?? 0.75;
              const contraPct = Math.round(contraLevel * 100);

              return (
                <button
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
                  aria-current={selectedClaim?.id === claim.id ? "true" : undefined}
                  className="ledger-row group w-full text-left"
                >
                  <span className="index-numeral">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-serif text-[17px] leading-snug text-ink group-hover:text-gold transition-colors">
                      {claim.text}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted mt-1 flex-wrap">
                      {claim.article_slug && (
                        <Link
                          href={`/article/${claim.article_slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="category-link no-underline font-medium"
                        >
                          {claim.article_slug.replace(/-/g, " ")}
                        </Link>
                      )}
                      <span className="font-mono tabular-nums">
                        {Math.round(claim.derived_confidence * 100)}% conf
                      </span>
                    </span>
                    <span className="flex items-center gap-2 pt-2 max-w-sm" aria-label={`Dispute level ${contraPct} percent`}>
                      <span className="flex-1 h-[3px] bg-ink/10 overflow-hidden">
                        <span className="block h-full bg-oxblood" style={{ width: `${contraPct}%` }} />
                      </span>
                      <span className="font-mono text-[11px] text-oxblood tabular-nums">{contraPct}%</span>
                    </span>
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-oxblood shrink-0">
                    Contested
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ClaimDetailRail claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
    </div>
  );
}
