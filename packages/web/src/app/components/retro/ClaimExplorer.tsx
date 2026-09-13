"use client";
import { useEffect, useMemo, useState } from "react";
import ClaimExplorerCanvas from "./ClaimExplorerCanvas";
import RetroInspector from "./RetroInspector";
import { contradictionOf } from "@/lib/retro";

// ponytail: thin composer — canvas does physics, inspector does evidence. No per-frame React state.
export default function ClaimExplorer({ nodes, edges, selectedId: extSel, onSelect, hideInspector }: { nodes: any[]; edges: any[]; selectedId?: string | null; onSelect?: (id: string | null) => void; hideInspector?: boolean }) {
  const [mode, setMode] = useState<"all" | "support" | "weakest">("all");
  const [sel, setSel] = useState<string | null>(null);
  const selectedId = extSel !== undefined ? extSel : sel;
  const setSelected = (id: string | null) => { if (extSel === undefined) setSel(id); onSelect?.(id); };

  const centralId = useMemo(() => {
    let best = -Infinity, id = nodes[0]?.id ?? null;
    for (const n of nodes) {
      if (n.type !== "claim") continue;
      const s = contradictionOf(n) * 10 + edges.filter((e: any) => e.target === n.id).length;
      if (s > best) { best = s; id = n.id; }
    }
    return id;
  }, [nodes, edges]);

  const weakestId = useMemo(() => {
    let id: string | null = null, best = Infinity;
    for (const n of nodes) {
      if (n.type !== "claim" || n.id === centralId) continue;
      const c = typeof n.confidence === "number" ? n.confidence : 0.5;
      if (c < best) { best = c; id = n.id; }
    }
    return id;
  }, [nodes, centralId]);

  // ponytail: filter applies to physics AND paint — hidden contradicts can't pull layout.
  const fed = useMemo(() => (mode === "support" ? edges.filter((e: any) => e.relationship !== "contradicts" && e.type !== "contradicts") : edges), [edges, mode]);

  useEffect(() => {
    if (mode === "weakest" && weakestId) setSelected(weakestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, weakestId]);

  useEffect(() => {
    if (!selectedId && centralId) setSelected(centralId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralId]);

  const node = nodes.find((n: any) => n.id === selectedId) ?? null;

  const handleCanvasSelect = (n: any | null) => {
    if (!n) return; // ponytail: keep selection on background click — null clears inspector by accident.
    setSelected(n.id);
  };

  if (nodes.length === 0) return <div className="text-[11px] bg-white border p-3">No claim graph yet — generate the article to seed it.</div>;

  return (
    <div className="w-full">
      <div className="flex gap-[6px] mb-2 flex-wrap">
        {[["all", "Show All"], ["support", "Show Supporting Only"], ["weakest", "Highlight Weakest Link"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k as any)} className="px-3 py-[3px] text-[11px] border-[2px] bg-[#d4d0c8] text-black" style={{ borderStyle: mode === k ? "inset" : "outset" }}>{l}</button>
        ))}
      </div>
      <ClaimExplorerCanvas nodes={nodes} edges={fed} selectedId={mode === "weakest" ? weakestId : selectedId} centralId={centralId} onSelect={handleCanvasSelect} />
      {!hideInspector && <div className="mt-2"><RetroInspector node={mode === "weakest" ? nodes.find((n: any) => n.id === weakestId) ?? node : node} nodes={nodes} edges={edges} centralId={centralId} /></div>}
    </div>
  );
}
