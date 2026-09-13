"use client";
import { useMemo } from "react";
import { contradictionOf, retroStatusColor, smartShort } from "@/lib/retro";

// ponytail: the global claim MAP — territories per article, hottest disputes first. No geo needed.
export default function ClaimAtlasMap({ nodes, edges, selectedId, onSelect, onOpenGraph }: { nodes: any[]; edges: any[]; selectedId: string | null; onSelect: (id: string | null) => void; onOpenGraph?: (slug: string) => void }) {
  const evCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of edges) if (e.type === "evidence") m[e.target] = (m[e.target] ?? 0) + 1;
    return m;
  }, [edges]);
  const territories = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const n of nodes) {
      if (n.type !== "claim") continue;
      const k = n.article_slug ?? "unfiled";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(n);
    }
    const list = [...groups.entries()].map(([slug, claims]) => {
      const heat = claims.reduce((a, c) => a + contradictionOf(c), 0) / Math.max(1, claims.length);
      claims.sort((a, b) => contradictionOf(b) - contradictionOf(a) || (b.confidence ?? 0.5) - (a.confidence ?? 0.5));
      return { slug, title: claims[0]?.article_title ?? slug, claims, heat };
    });
    list.sort((a, b) => b.heat - a.heat);
    return list;
  }, [nodes]);

  if (nodes.length === 0) return <div className="text-[11px] bg-white border p-3">No claims yet — generate articles to seed the map.</div>;

  return (
    <div className="space-y-2">
      {territories.map((t) => (
        <section key={t.slug} aria-label={`Claims from ${t.title}`} className="border-[2px] bg-[#fdf8e8]" style={{ borderStyle: "outset", borderWidth: 2 }}>
          <header className="bg-[#0a2a5e] text-white px-2 py-1 flex items-center gap-2">
            <span className="text-[11px] font-bold truncate flex-1">{t.title}</span>
            <span className="text-[9px] bg-[#c9a227] text-black px-1 border border-black shrink-0">{t.claims.length} claims</span>
            {onOpenGraph && (
              <button onClick={() => onOpenGraph(t.slug)} aria-label={`Open claim graph for ${t.title}`} className="text-[9px] font-bold bg-[#d4d0c8] text-black px-1.5 py-0 border shrink-0" style={{ borderStyle: "outset", borderWidth: 1, borderColor: "#fff #404040 #404040 #fff" }}>
                Graph →
              </button>
            )}
          </header>
          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {t.claims.map((c: any) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(active ? null : c.id)}
                  aria-pressed={active}
                  aria-label={`Claim: ${c.short_label ?? c.label}. Status ${c.status}.`}
                  className="text-left bg-white border p-1.5 flex gap-1.5 items-start hover:bg-[#fff8dc]"
                  style={{ borderStyle: active ? "inset" : "outset", borderWidth: 2, borderColor: active ? "#0a2a5e" : undefined }}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-black shrink-0 mt-0.5" style={{ background: retroStatusColor(c.status) }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[11px] leading-[1.3] text-black">{smartShort(c.short_label ?? c.label, 90)}</span>
                    <span className="block text-[9px] text-[#555] mt-0.5 tabular-nums">
                      {c.status} • {typeof c.confidence === "number" ? `${(c.confidence * 100).toFixed(0)}%` : "—"} • {evCount[c.id] ?? 0} ev{contradictionOf(c) > 0 ? ` • contra ${(contradictionOf(c)).toFixed(2)}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
