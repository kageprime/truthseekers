"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGlobalClaimGraph } from "../hooks";
import ClaimGraphViewer from "../components/ClaimGraphViewer";
import ClaimGenealogyPanel from "../components/ClaimGenealogyPanel";
import EyebrowTag from "../components/EyebrowTag";
import RetroWindow from "../components/retro/RetroWindow";
import ClaimExplorer from "../components/retro/ClaimExplorer";
import RetroInspector from "../components/retro/RetroInspector";
import { IS_RETRO } from "@/lib/retro";
import { contradictionOf } from "@/lib/retro";
import type { ClaimGraphNode } from "@/lib/api";

export default function GlobalClaimGraphPage() {
  const router = useRouter();
  const [limit, setLimit] = useState(150);
  const [minContradiction, setMinContradiction] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState<ClaimGraphNode | null>(null);
  const { data, loading } = useGlobalClaimGraph(limit, minContradiction);

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

  const navigateToArticle = useCallback(
    (n: { type?: string; article_slug?: string }) => {
      if (n?.type === "claim" && (n as any).article_slug) {
        router.push(`/article/${(n as any).article_slug}`);
      }
    },
    [router]
  );

  // ponytail: retro Atlas — 3-col chrome, shared selection, live filters.
  const [retroSel, setRetroSel] = useState<string | null>(null);
  const retroCentral = data ? (() => { let b = -Infinity, id: string | null = data.nodes[0]?.id ?? null; for (const n of data.nodes) { if ((n as any).type !== "claim") continue; const s = contradictionOf(n as any) * 10 + data.edges.filter((e) => e.target === n.id).length; if (s > b) { b = s; id = n.id; } } return id; })() : null;
  const retroNode = data?.nodes.find((n) => n.id === retroSel) ?? data?.nodes.find((n) => n.id === retroCentral) ?? null;
  if (IS_RETRO) {
    return (
      <RetroWindow title="Microsoft Encarta Encyclopedia 98 - Claimgraph Atlas" address="encarta.msn.com/Atlas/ClaimGraph" status={`MS Encarta • ${data?.nodes.length ?? 0} nodes • ${data?.edges.length ?? 0} edges`}>
        <div className="r-side w-full lg:w-[270px] shrink-0 bg-[#e8e0c5] border-r-[2px] border-[#8a7f68] p-2 space-y-2 overflow-auto">
          <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1">Atlas Controls</div>
          <div>
            <div className="text-[10px] font-bold mb-1">Claims</div>
            <div className="flex flex-wrap gap-1">{[50, 100, 150, 300].map((n) => <button key={n} onClick={() => setLimit(n)} className="px-2 py-[2px] text-[11px] border-[2px] bg-[#d4d0c8] text-black" style={{ borderStyle: limit === n ? "inset" : "outset" }}>{n}</button>)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold mb-1">Min contradiction</div>
            <div className="flex flex-wrap gap-1">{[0, 0.2, 0.4, 0.6].map((v) => <button key={v} onClick={() => setMinContradiction(v)} className="px-2 py-[2px] text-[11px] border-[2px] bg-[#d4d0c8] text-black" style={{ borderStyle: minContradiction === v ? "inset" : "outset" }}>{v.toFixed(1)}</button>)}</div>
          </div>
          {data && <div className="text-[10px] text-[#555] tabular-nums">{data.claim_count} claims • {data.nodes.length - data.claim_count} evidence</div>}
          <div className="text-[10px] underline"><Link href="/contested">Contested</Link> • <Link href="/gaps">Open questions</Link> • <Link href="/stale">Stale</Link></div>
        </div>
        <div className="flex-1 min-w-0 bg-[#efe9d5] p-2 overflow-auto">
          <div className="bg-white p-2 max-w-[900px] mx-auto" style={{ borderStyle: "inset", borderWidth: 3, borderColor: "#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
            <div className="text-[10px] tracking-widest uppercase text-[#0a2a5e] font-bold">Claimgraph Atlas • Interactive</div>
            <h1 className="r-h1" style={{ fontSize: 26 }}>Global Claim Graph</h1>
            {loading && <div className="text-[11px] py-8 text-center">Loading claim graph…</div>}
            {!loading && data && data.nodes.length > 0 && <ClaimExplorer nodes={data.nodes} edges={data.edges} selectedId={retroSel ?? retroCentral} onSelect={setRetroSel} hideInspector />}
            {!loading && data && data.nodes.length === 0 && <div className="text-[11px] py-8 text-center">No claims yet — generate articles to seed the graph.</div>}
          </div>
        </div>
        <div className="r-side w-full lg:w-[340px] shrink-0 bg-[#e8e0c5] border-l-[2px] border-[#8a7f68] p-2 overflow-auto">
          <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 mb-2">Inspector</div>
          {data && <RetroInspector node={retroNode} nodes={data.nodes} edges={data.edges} centralId={retroCentral} />}
        </div>
      </RetroWindow>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      <div className="mb-8 md:mb-10">
        <div className="reveal-blur mb-5">
          <EyebrowTag label="Claim graph · Live" />
        </div>
        <h1
          className="reveal-blur font-display font-bold mb-3"
          style={{ fontSize: "clamp(2rem, 1.5rem + 2.5vw, 3.25rem)", letterSpacing: "-0.025em", lineHeight: 1.05, color: "var(--ink)" }}
        >
          The global claim graph
        </h1>
        <p className="reveal-blur text-sm leading-relaxed max-w-2xl" style={{ color: "var(--muted)" }}>
          Every claim the encyclopedia has produced, joined to its evidence and to the other claims it supports or contradicts.
          Click a claim to trace its genealogy — sources, contradictions, and the forensic chain of custody for every piece of evidence.
        </p>
      </div>

      <div className="bezel mb-6">
        <div className="bezel-inner flex flex-wrap items-center gap-3 md:gap-5 px-4 md:px-5 py-3.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="eyebrow !text-[9px] !py-0.5">Claims</span>
            {[50, 100, 150, 300].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className="px-2.5 py-1 rounded-full border cursor-pointer transition-all duration-300"
                style={{
                  borderColor: limit === n ? "var(--accent)" : "var(--border-light, #e5e5e5)",
                  background: limit === n ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                  color: limit === n ? "var(--accent-dark)" : "var(--muted, #777)",
                  fontWeight: limit === n ? 600 : 400,
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="eyebrow !text-[9px] !py-0.5">Min contradiction</span>
            {[0, 0.2, 0.4, 0.6].map((v) => (
              <button
                key={v}
                onClick={() => setMinContradiction(v)}
                className="px-2.5 py-1 rounded-full border cursor-pointer transition-all duration-300"
                style={{
                  borderColor: minContradiction === v ? "var(--accent)" : "var(--border-light, #e5e5e5)",
                  background: minContradiction === v ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                  color: minContradiction === v ? "var(--accent-dark)" : "var(--muted, #777)",
                  fontWeight: minContradiction === v ? 600 : 400,
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              >
                {v.toFixed(1)}
              </button>
            ))}
          </div>
          {data && (
            <span className="ml-auto tabular-nums" style={{ color: "var(--subtle, #999)" }}>
              {data.claim_count} claims · {data.nodes.length - data.claim_count} evidence
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-24 text-center text-xs" style={{ color: "var(--subtle)" }}>Loading global claim graph…</div>
      )}

      {!loading && data && data.nodes.length === 0 && (
        <div className="py-24 text-center text-xs" style={{ color: "var(--subtle)" }}>
          No claims have been written yet. Generate some articles to seed the graph.
        </div>
      )}

      {!loading && data && data.nodes.length > 0 && (
        <ClaimGraphViewer data={data} loading={loading} height={selectedClaim ? 420 : 620} onNodeClick={handleClick} />
      )}

      {selectedClaim && data && (
        <div className="mt-5">
          <ClaimGenealogyPanel
            claim={selectedClaim}
            nodes={data.nodes}
            edges={data.edges}
            onSelectClaim={handleSelectClaimById}
            onClose={() => setSelectedClaim(null)}
          />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4 text-[10px]" style={{ color: "var(--muted)" }}>
        <span>
          See also:{" "}
          <Link href="/contested" className="hover:underline" style={{ color: "var(--accent)" }}>
            Contested claims
          </Link>
          {" · "}
          <Link href="/gaps" className="hover:underline" style={{ color: "var(--accent)" }}>
            Open questions
          </Link>
          {" · "}
          <Link href="/stale" className="hover:underline" style={{ color: "var(--accent)" }}>
            Stale watch
          </Link>
        </span>
      </div>
    </div>
  );
}
