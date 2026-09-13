"use client";
import { useMemo } from "react";
import { useArticleEpistemic, useGlobalClaimGraph } from "./useApi";
import { contradictionOf } from "@/lib/retro";

// ponytail: one normalized graph source — epistemic composite per-article, global hook otherwise.
export function useRetroArticleGraph(slug: string | undefined) {
  const { data, loading, error, refetch } = useArticleEpistemic(slug);
  const graph = useMemo(() => {
    const g = (data as any)?.claim_graph;
    if (!g) return { nodes: [], edges: [] };
    return { nodes: g.nodes ?? [], edges: g.edges ?? [] };
  }, [data]);
  const evidenceByClaim = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of graph.edges) {
      if (e.type !== "evidence") continue;
      (map[e.target] ??= []).push(e);
    }
    return map;
  }, [graph]);
  const centralId = useMemo(() => {
    let best = -Infinity, id = graph.nodes[0]?.id;
    for (const n of graph.nodes) {
      if (n.type !== "claim") continue;
      const s = contradictionOf(n) * 10 + graph.edges.filter((e: any) => e.target === n.id).length;
      if (s > best) { best = s; id = n.id; }
    }
    return id;
  }, [graph]);
  return { epistemic: data, graph, evidenceByClaim, centralId, loading, error, refetch };
}

export function useRetroGlobalGraph(limit = 150, minContradiction = 0) {
  const { data, loading, error, refetch } = useGlobalClaimGraph(limit, minContradiction);
  return { data, loading, error, refetch };
}
