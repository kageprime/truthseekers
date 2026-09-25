"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchArticleClaimGraph } from "@/lib/api";
import type { ClaimGraphEdge, ClaimGraphNode } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { Skeleton } from "./ui/skeleton";

const EDGE_COLOR: Record<string, string> = {
  supports: "#047857",
  contradicts: "#be123c",
  related: "#a8a29e",
};

const CLAIM_DOT: Record<string, string> = {
  supported: "#047857",
  disputed: "#d97706",
  weak: "#be123c",
  unknown: "#78716c",
};

const MAX_NODES = 40;

// ponytail: deterministic two-column SVG — claims left, evidence right. No
// force layout, no new deps. The endpoint takes ~20s, so fetching lives in
// <GraphBody/>, mounted only after the user expands the toggle.
export function ClaimGraph({ slug }: { slug: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="mt-4 w-full border border-ink/25 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] hover:border-coral hover:text-coral"
      >
        Show claim graph — claims × evidence
      </button>
    );
  }
  return <GraphBody slug={slug} onHide={() => setExpanded(false)} />;
}

function GraphBody({ slug, onHide }: { slug: string; onHide: () => void }) {
  const router = useRouter();
  const graph = useApi((signal) => fetchArticleClaimGraph(slug, signal), `claimgraph:${slug}`);

  const nodes = (graph.data?.nodes ?? []).slice(0, MAX_NODES);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (graph.data?.edges ?? []).filter((e) => ids.has(e.source) && ids.has(e.target));
  const claims = nodes.filter((n) => n.type === "claim");
  const evidence = nodes.filter((n) => n.type !== "claim");

  const rowH = 34;
  const W = 680;
  const H = Math.max(claims.length, evidence.length, 1) * rowH + 70;
  const pos = new Map<string, { x: number; y: number }>();
  claims.forEach((n, i) =>
    pos.set(n.id, { x: 150, y: 50 + i * ((H - 80) / Math.max(claims.length, 1)) })
  );
  evidence.forEach((n, i) =>
    pos.set(n.id, { x: 530, y: 50 + i * ((H - 80) / Math.max(evidence.length, 1)) })
  );

  const label = (n: ClaimGraphNode) =>
    (n.short_label || n.label || n.id).slice(0, 34) + ((n.short_label || n.label || "").length > 34 ? "…" : "");

  const openClaim = (n: ClaimGraphNode) => {
    if (n.type === "claim") router.push(`/claims?claim=${encodeURIComponent(n.id)}`);
  };

  return (
    <div className="mt-4 border border-ink/20 bg-paper">
      <div className="flex items-center justify-between border-b border-ink/15 px-4 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">
          Claim graph / {nodes.length} nodes · {edges.length} edges
        </p>
        <button onClick={onHide} className="font-mono text-[10px] uppercase text-muted underline">
          Hide
        </button>
      </div>
      {graph.loading && !graph.data && (
        <div className="space-y-2 p-4" aria-label="Loading claim graph">
          <Skeleton className="h-4 w-full bg-ink/10" />
          <Skeleton className="h-4 w-5/6 bg-ink/10" />
          <Skeleton className="h-4 w-4/6 bg-ink/10" />
          <p className="font-mono text-[10px] uppercase text-muted">Assembling graph — the endpoint takes ~20s…</p>
        </div>
      )}
      {graph.error && !graph.data && (
        <div className="p-4">
          <p className="font-mono text-[10px] uppercase text-coral">Graph failed to load.</p>
          <button onClick={() => graph.refetch()} className="mt-2 font-mono text-[10px] uppercase underline">
            Retry
          </button>
        </div>
      )}
      {graph.data && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Claim evidence graph">
          {edges.map((e, i) => {
            const a = pos.get(e.source);
            const b = pos.get(e.target);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={EDGE_COLOR[e.relationship] ?? "#a8a29e"}
                strokeWidth={e.relationship === "contradicts" ? 2 : 1}
                strokeDasharray={e.relationship === "related" ? "4 3" : undefined}
                opacity={0.7}
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id)!;
            const isClaim = n.type === "claim";
            const fill = isClaim ? CLAIM_DOT[n.status ?? "unknown"] ?? "#78716c" : "#151515";
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                onClick={() => openClaim(n)}
                style={isClaim ? { cursor: "pointer" } : undefined}
              >
                <circle r={isClaim ? 6 : 4} fill={fill} stroke="#f5f1e8" strokeWidth={1.5} />
                <text
                  x={isClaim ? -14 : 12}
                  y={4}
                  textAnchor={isClaim ? "end" : "start"}
                  fontSize={11}
                  fontFamily="Georgia, serif"
                  fill="#151515"
                >
                  {label(n)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {graph.data && (
        <div className="flex flex-wrap gap-4 border-t border-ink/15 px-4 py-2 font-mono text-[9px] uppercase text-muted">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#047857" }} /> supports</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#be123c" }} /> contradicts</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#a8a29e" }} /> related</span>
          <span className="ml-auto">click a claim to open its tab →</span>
        </div>
      )}
    </div>
  );
}

export type { ClaimGraphEdge, ClaimGraphNode };
