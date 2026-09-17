"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGlobalClaimGraph } from "../hooks";
import ClaimGraphViewer from "../components/ClaimGraphViewer";
import ClaimGenealogyPanel from "../components/ClaimGenealogyPanel";
import EyebrowTag from "../components/EyebrowTag";
import type { ClaimGraphNode } from "@/lib/api";
import { useUiMode } from "../context/UiModeContext";

export default function GlobalClaimGraphPage() {
  const router = useRouter();
  const [limit, setLimit] = useState(150);
  const [minContradiction, setMinContradiction] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState<ClaimGraphNode | null>(null);
  const { data, loading } = useGlobalClaimGraph(limit, minContradiction);
  const { widthMode } = useUiMode();

  const handleClick = useCallback(
    (n: ClaimGraphNode) => {
      if (n.type === "claim") {
        setSelectedClaim(n);
      }
    },
    []
  );

  const handleSelectClaimById = useCallback(
    (claimId: string) => {
      if (!data) return;
      const node = data.nodes.find((n) => n.id === claimId && n.type === "claim");
      if (node) setSelectedClaim(node);
    },
    [data]
  );

  const containerClass = widthMode === "expanded" ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} mx-auto transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Live topology</span>
            <span>Global epistemic network</span>
          </div>
          <h1 className="plate-title">Claim graph</h1>
          <p className="plate-deck">
            Every claim produced across the encyclopedia, joined to its evidence
            and adjacent claims. Select a node to inspect its provenance.
          </p>
          <div className="plate-rule" />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-5 gap-y-2 flex-wrap py-4 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono uppercase tracking-[0.14em] text-subtle">Claims</span>
            {[50, 100, 150, 300].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`font-mono tabular-nums cursor-pointer transition-colors ${
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

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono uppercase tracking-[0.14em] text-subtle">Min contradiction</span>
            {[0, 0.2, 0.4, 0.6].map((v) => (
              <button
                key={v}
                onClick={() => setMinContradiction(v)}
                className={`font-mono tabular-nums cursor-pointer transition-colors ${
                  minContradiction === v
                    ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                    : "text-subtle hover:text-ink"
                }`}
                aria-pressed={minContradiction === v}
              >
                {v.toFixed(1)}
              </button>
            ))}
          </div>

          {data && (
            <span className="ml-auto text-xs font-mono text-subtle tabular-nums">
              {data.claim_count} claims · {data.nodes.length - data.claim_count} evidence
            </span>
          )}
        </div>

        {/* Graph Viewport */}
        {loading && (
          <p className="font-serif italic text-muted py-24 text-center">
            Mapping global epistemic topology…
          </p>
        )}

        {!loading && data && data.nodes.length === 0 && (
          <p className="font-serif italic text-muted py-24 text-center">
            No claims recorded yet. Generate articles to populate the knowledge graph.
          </p>
        )}

        {!loading && data && data.nodes.length > 0 && (
          <div className="border border-rule rounded-sharp overflow-hidden bg-surface-elevated p-2">
            <ClaimGraphViewer
              data={data}
              loading={loading}
              height={selectedClaim ? 420 : 600}
              onNodeClick={handleClick}
            />
          </div>
        )}

        {/* Selected Claim Genealogy */}
        {selectedClaim && data && (
          <div className="mt-6 border border-rule rounded-sharp overflow-hidden bg-surface-elevated">
            <ClaimGenealogyPanel
              claim={selectedClaim}
              nodes={data.nodes}
              edges={data.edges}
              onSelectClaim={handleSelectClaimById}
              onClose={() => setSelectedClaim(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
