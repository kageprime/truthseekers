"use client";
import Link from "next/link";
import { domainOf, retroStatusColor } from "@/lib/retro";

// ponytail: one inspector for article + global — evidence dots expand here, not on canvas.
export default function RetroInspector({ node, nodes, edges, centralId }: { node: any | null; nodes: any[]; edges: any[]; centralId?: string | null }) {
  if (!node) return <div className="border-[2px] bg-white p-3 text-[11px] text-[#555]" style={{ borderStyle: "inset", borderColor: "#a09060 #fff9e5 #fff9e5 #a09060" }}>Click a claim node to inspect evidence, chain of custody, and linked claims.</div>;
  const isEv = node.type === "evidence";
  const linked = edges.filter((e: any) => e.source === node.id || e.target === node.id);
  const evLinks = linked.filter((e: any) => e.type === "evidence");
  const claimLinks = linked.filter((e: any) => e.type === "claim");
  const byId = new Map(nodes.map((n: any) => [n.id, n]));
  const cv: Record<string, number> = node.confidence_vector ?? {};
  return (
    <div className="border-[2px] bg-white p-3" style={{ borderStyle: "inset", borderColor: "#a09060 #fff9e5 #fff9e5 #a09060" }}>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-[#0a2a5e] flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border border-black shrink-0" style={{ background: retroStatusColor(node.status) }} />
            <span className="break-words">{node.label || node.id}</span>
            {node.id === centralId && <span className="px-1.5 py-0.5 bg-[#c9a227] text-black text-[9px] font-bold border border-black shrink-0">CENTRAL CLAIM</span>}
          </div>
          {!isEv && typeof node.confidence === "number" && <div className="text-[10px] text-[#555] mt-1">Conf {(node.confidence * 100).toFixed(0)}% • {node.status ?? "unknown"}{node.article_slug ? ` • ${node.article_slug}` : ""}</div>}
          {isEv && <div className="text-[10px] text-[#555] mt-1">{node.supports ? "supports" : "contradicts"} • chain: {node.chain_of_custody ?? "?"} • {node.accessibility ?? "public"}</div>}
          {Object.keys(cv).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(cv).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[10px] text-[#555]"><span className="w-28 truncate">{k}</span><span className="flex-1 h-[5px] bg-[#efe9d5] border border-[#8a7f68]"><span className="block h-full bg-[#0a2a5e]" style={{ width: `${Math.max(0, Math.min(1, Number(v))) * 100}%` }} /></span><span className="tabular-nums">{Number(v).toFixed(2)}</span></div>
              ))}
            </div>
          )}
          {evLinks.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-bold text-[#0a2a5e] uppercase tracking-wide">Evidence ({evLinks.length})</div>
              <div className="mt-1 space-y-1">
                {evLinks.slice(0, 8).map((e: any, i: number) => {
                  const otherId = e.source === node.id ? e.target : e.source;
                  const other = byId.get(otherId) as any;
                  if (!other) return null;
                  return <a key={i} href={other.label?.startsWith("http") ? other.label : undefined} target="_blank" rel="noreferrer" className="block text-[11px] border border-[#c0c0c0] bg-[#fffef6] px-1.5 py-1 no-underline text-black hover:bg-[#fff8dc]"><span className={e.relationship === "supports" ? "text-[#2e7d32] font-bold" : "text-[#a33] font-bold"}>{e.relationship === "supports" ? "+" : "–"}</span> {domainOf(other.label)} <span className="text-[#555]">• {other.chain_of_custody ?? "?"} • {other.accessibility ?? ""}</span></a>;
                })}
              </div>
            </div>
          )}
          {claimLinks.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-bold text-[#0a2a5e] uppercase tracking-wide">Linked claims ({claimLinks.length})</div>
              <div className="mt-1 space-y-1">
                {claimLinks.slice(0, 6).map((e: any, i: number) => {
                  const other = byId.get(e.source === node.id ? e.target : e.source) as any;
                  if (!other) return null;
                  return <div key={i} className="text-[11px]"><span>{e.relationship === "supports" ? "→" : "↯"}</span> <span className="underline">{String(other.label).slice(0, 80)}</span> <span className="text-[#555]">[{e.relationship}{typeof e.strength === "number" ? ` ${e.strength.toFixed(2)}` : ""}]</span></div>;
                })}
              </div>
            </div>
          )}
        </div>
        <div className="text-[9px] text-[#555] max-w-[150px] border-l pl-2 shrink-0">
          <div className="font-bold text-[#0a2a5e]">Citation</div>
          <div className="break-words">{isEv ? node.label : (node.article_title ? `${node.article_title} • ${node.article_slug}` : (node.article_slug ?? node.id))}</div>
          {node.article_slug && <Link href={`/article/${node.article_slug}`} className="mt-2 inline-block px-2 py-1 bg-[#0a2a5e] text-[#c9a227] text-[10px] font-bold no-underline border border-black">Open article →</Link>}
        </div>
      </div>
    </div>
  );
}
