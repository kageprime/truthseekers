"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGlobalClaimGraph } from "../hooks";
import ClaimGraphViewer from "../components/ClaimGraphViewer";
import ClaimConstellation3D from "../components/ClaimConstellation3D";
import ClaimGenealogyPanel from "../components/ClaimGenealogyPanel";
import EyebrowTag from "../components/EyebrowTag";
import type { ClaimGraphNode } from "@/lib/api";
import { useUiMode } from "../context/UiModeContext";

export default function GlobalClaimGraphPage() {
  const router = useRouter();
  const [limit, setLimit] = useState(150);
  const [minContradiction, setMinContradiction] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState<ClaimGraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const { data, loading } = useGlobalClaimGraph(limit, minContradiction);
  const { widthMode, alignClass } = useUiMode();

  // Prefer 2D if user has reduced-motion enabled
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setViewMode("2d");
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !debouncedQuery) return;
    const q = debouncedQuery.toLowerCase();
    const hit = data.nodes.find(
      (n) => n.type === "claim" && (n.label || n.id).toLowerCase().includes(q)
    );
    if (hit) {
      setSelectedClaim(hit);
    }
  };

  const containerClass = widthMode === "expanded" ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} ${alignClass} transition-all duration-300`}>
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

        {/* Search Bar + Controls */}
        <div className="flex flex-col gap-3 py-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 border-b-2 border-ink pb-2 focus-within:border-gold transition-colors">
            <span className="text-subtle text-lg leading-none" aria-hidden>⌕</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search claims in constellation (e.g. quantum, inflation, virus)…"
              aria-label="Search claims in graph"
              className="flex-1 bg-transparent border-none outline-none font-serif text-base text-ink placeholder:text-subtle min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs font-mono text-subtle hover:text-ink cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="text-xs font-mono font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-gold disabled:opacity-30 disabled:no-underline cursor-pointer shrink-0"
            >
              Locate ↵
            </button>
          </form>

          <div className="flex items-center gap-5 gap-y-2 flex-wrap text-xs">
            {/* 3D / 2D toggle */}
            <div className="flex items-center gap-2 border border-rule rounded-sharp px-2 py-1 bg-surface-elevated">
              <span className="font-mono uppercase tracking-[0.14em] text-subtle">Engine</span>
              <button
                type="button"
                onClick={() => setViewMode("3d")}
                className={`font-mono cursor-pointer transition-colors ${
                  viewMode === "3d"
                    ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                    : "text-subtle hover:text-ink"
                }`}
                aria-pressed={viewMode === "3d"}
              >
                3D Constellation
              </button>
              <span className="text-rule">/</span>
              <button
                type="button"
                onClick={() => setViewMode("2d")}
                className={`font-mono cursor-pointer transition-colors ${
                  viewMode === "2d"
                    ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                    : "text-subtle hover:text-ink"
                }`}
                aria-pressed={viewMode === "2d"}
              >
                2D Force
              </button>
            </div>

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
            {viewMode === "3d" ? (
              <ClaimConstellation3D
                data={data}
                selectedClaimId={selectedClaim?.id}
                searchFilter={debouncedQuery}
                height={selectedClaim ? 440 : 620}
                onNodeClick={handleClick}
                onWebGLUnavailable={() => setViewMode("2d")}
              />
            ) : (
              <ClaimGraphViewer
                data={data}
                loading={loading}
                height={selectedClaim ? 420 : 600}
                onNodeClick={handleClick}
              />
            )}
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
