"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGlobalClaimGraph } from "../hooks";
import ClaimGraphViewer from "../components/ClaimGraphViewer";
import ClaimGenealogyPanel from "../components/ClaimGenealogyPanel";
import EyebrowTag from "../components/EyebrowTag";
import RetroShell from "../components/retro/RetroShell";
import ClaimAtlasMap from "../components/retro/ClaimAtlasMap";
import ClaimExplorer from "../components/retro/ClaimExplorer";
import RetroInspector from "../components/retro/RetroInspector";
import { IS_RETRO } from "@/lib/retro";
import { contradictionOf, toSubgraph } from "@/lib/retro";
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

  // ponytail: retro Atlas — 3-col chrome, shared selection, live filters. Graph derives from the same payload.
  const [retroSel, setRetroSel] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "graph">("map");
  const [territory, setTerritory] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const subgraph = useMemo(
    () => (data ? toSubgraph(data.nodes as any[], data.edges as any[], { territory, focusId }) : { nodes: [], edges: [] }),
    [data, territory, focusId]
  );
  const openGraph = useCallback((slug: string | null, focus: string | null = null) => {
    setTerritory(slug); setFocusId(focus); setView("graph");
  }, []);
  const retroCentral = data ? (() => { let b = -Infinity, id: string | null = data.nodes[0]?.id ?? null; for (const n of data.nodes) { if ((n as any).type !== "claim") continue; const s = contradictionOf(n as any) * 10 + data.edges.filter((e) => e.target === n.id).length; if (s > b) { b = s; id = n.id; } } return id; })() : null;
  const retroNode = data?.nodes.find((n) => n.id === retroSel) ?? data?.nodes.find((n) => n.id === retroCentral) ?? null;
  if (IS_RETRO) {
    const scopeLabel = focusId ? "claim focus" : territory ? "territory" : "everything";
    // ponytail: same Contents shell as articles/contested/gaps/stale — atlas controls fold into a toolbar, not a second sidebar.
    return (
      <RetroShell wide>
        <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
          <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">Claim Map • Territories by article • {scopeLabel}</div>
          <h1 className="r-h1" style={{ fontSize: 26 }}>{view === "map" ? "Global Claim Map" : "Global Claim Graph"}</h1>
        </div>
        <div className="bg-[#e8e0c5] border-[2px] border-[#8a7f68] p-2 mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[10px] font-bold">View</span>
            <div className="flex flex-wrap gap-1">{([["map", "Map"], ["graph", "Graph"]] as const).map(([v, label]) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="px-2 py-[2px] text-[11px] border-[2px] bg-[#d4d0c8] text-black" style={{ borderStyle: view === v ? "inset" : "outset" }}>{label}</button>)}</div>
            <span className="text-[10px] font-bold ml-2">Claims</span>
            <div className="flex flex-wrap gap-1">{[50, 100, 150, 300].map((n) => <button key={n} onClick={() => setLimit(n)} className="px-2 py-[2px] text-[11px] border-[2px] bg-[#d4d0c8] text-black" style={{ borderStyle: limit === n ? "inset" : "outset" }}>{n}</button>)}</div>
            <span className="text-[10px] font-bold ml-2">Min contradiction</span>
            <div className="flex flex-wrap gap-1">{[0, 0.2, 0.4, 0.6].map((v) => <button key={v} onClick={() => setMinContradiction(v)} className="px-2 py-[2px] text-[11px] border-[2px] bg-[#d4d0c8] text-black" style={{ borderStyle: minContradiction === v ? "inset" : "outset" }}>{v.toFixed(1)}</button>)}</div>
          </div>
          {(territory || focusId) && (
            <div className="bg-[#ffffe1] border border-black p-1.5 text-[10px] leading-[1.4] flex flex-wrap items-center gap-2">
              <span className="font-bold">Scoped: {focusId ? "1 claim + neighbors" : territory}</span>
              {focusId && <button onClick={() => setFocusId(null)} className="r-btn px-1.5 py-0">Widen</button>}
              <button onClick={() => { setTerritory(null); setFocusId(null); }} className="r-btn px-1.5 py-0">Clear</button>
            </div>
          )}
          {view === "graph" && retroSel && (
            <button onClick={() => setFocusId(retroSel)} className="r-btn px-2 py-1 text-[11px]" disabled={focusId === retroSel}>
              Focus graph on selected claim
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#555]">
            {data && <span className="tabular-nums">{data.claim_count} claims • {data.nodes.length - data.claim_count} evidence • {subgraph.nodes.length} in scope</span>}
            <span className="ml-auto underline"><Link href="/contested">Contested</Link> • <Link href="/gaps">Open questions</Link> • <Link href="/stale">Stale</Link></span>
          </div>
        </div>
        {loading && <div className="text-[11px] py-8 text-center">Surveying claims…</div>}
        {!loading && data && data.nodes.length > 0 && view === "map" && <div className="mt-2"><ClaimAtlasMap nodes={data.nodes} edges={data.edges} selectedId={retroSel ?? retroCentral} onSelect={setRetroSel} onOpenGraph={(slug) => openGraph(slug)} /></div>}
        {!loading && data && data.nodes.length > 0 && view === "graph" && (
          subgraph.nodes.length > 0
            ? <div className="mt-2"><ClaimExplorer nodes={subgraph.nodes} edges={subgraph.edges} selectedId={retroSel} onSelect={setRetroSel} hideInspector /></div>
            : <div className="text-[11px] py-8 text-center border-[2px] bg-[#ffffe1] mt-2" style={{ borderStyle: "outset" }}>No edges in this scope — claims stand alone here. <button className="underline" onClick={() => { setTerritory(null); setFocusId(null); }}>Clear scope</button></div>
        )}
        {!loading && data && data.nodes.length === 0 && <div className="text-[11px] py-8 text-center">No claims yet — generate articles to seed the map.</div>}
        {data && (
          <div className="mt-4 bg-[#e8e0c5] border-[2px] border-[#8a7f68] p-2">
            <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 mb-2">Inspector</div>
            <RetroInspector node={retroNode} nodes={data.nodes} edges={data.edges} centralId={retroCentral} />
          </div>
        )}
      </RetroShell>
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
