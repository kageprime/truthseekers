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
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-8 transition-all duration-300`}>
        {/* Header */}
        <div className="border-b border-zinc-200 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold text-[11px] uppercase tracking-wider border border-blue-200">
              Claim Graph · Live Topology
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500 text-xs">Global Epistemic Network</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 leading-[1.1]">
            Global Claim Graph
          </h1>

          <p className="font-serif text-base sm:text-lg text-zinc-600 italic leading-relaxed">
            Every claim produced across the encyclopedia, connected to its underlying evidence and adjacent supporting or contradicting claims. Click any node to inspect its forensic provenance.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-700 flex-wrap">
            <span className="text-zinc-500">Claims:</span>
            {[50, 100, 150, 300].map((n) => (
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

          <div className="flex items-center gap-2 text-xs font-medium text-zinc-700 flex-wrap">
            <span className="text-zinc-500">Min Contradiction:</span>
            {[0, 0.2, 0.4, 0.6].map((v) => (
              <button
                key={v}
                onClick={() => setMinContradiction(v)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  minContradiction === v
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
                aria-pressed={minContradiction === v}
              >
                {v.toFixed(1)}
              </button>
            ))}
          </div>

          {data && (
            <span className="text-xs font-mono text-zinc-500">
              {data.claim_count} claims · {data.nodes.length - data.claim_count} evidence edges
            </span>
          )}
        </div>

        {/* Graph Viewport */}
        {loading && (
          <div className="py-24 text-center text-xs text-zinc-400">
            Mapping global epistemic topology…
          </div>
        )}

        {!loading && data && data.nodes.length === 0 && (
          <div className="py-24 text-center text-xs text-zinc-500">
            No claims recorded yet. Generate articles to populate the knowledge graph.
          </div>
        )}

        {!loading && data && data.nodes.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-xs bg-white p-2">
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
          <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-xs bg-white">
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
