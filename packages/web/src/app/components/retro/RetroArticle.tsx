"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ClaimExplorer from "./ClaimExplorer";


// ponytail: one article template — TOC+doc+rail exact to Spinosaurus spec, data-driven.
export default function RetroArticle({ article, epistemic, graph }: { article: any; epistemic: any; graph: { nodes: any[]; edges: any[] } | null }) {
  const sections = [
    { id: "overview", label: "Overview", icon: "📖" },
    { id: "discovery", label: article?.title ? `About ${article.title}` : "Discovery", icon: "🏜️" },
    { id: "anatomy", label: "Evidence & Anatomy", icon: "🦴" },
    { id: "debate", label: "The Debate", icon: "⚖️", badge: "CONTROVERSY" },
    { id: "related", label: "Related & Quiz", icon: "❓" },
  ];
  const [active, setActive] = useState("overview");
  const [zoom, setZoom] = useState(false);
  const [q1, setQ1] = useState<number|null>(null);
  const refs = useRef<Record<string, HTMLElement|null>>({});
  useEffect(()=>{
    const io=new IntersectionObserver((es)=>{es.forEach((e)=>{if(e.isIntersecting)setActive(e.target.id);});},{rootMargin:"-20% 0px -60% 0px",threshold:0.1});
    Object.values(refs.current).forEach((el)=>el&&io.observe(el));
    return ()=>io.disconnect();
  },[]);
  const claims: any[] = epistemic?.claims ?? [];
  const g = graph ?? epistemic?.claim_graph ?? { nodes:[], edges:[] };
  const gaps: any[] = epistemic?.gaps ?? [];
  const fresh: any = epistemic?.freshness ?? null;
  const weakest = useMemo(() => {
    let id: string | null = null, best = Infinity;
    for (const c of claims) { const v = typeof c.derived_confidence === "number" ? c.derived_confidence : 0.5; if (v < best) { best = v; id = c.id; } }
    return claims.find((c) => c.id === id) ?? null;
  }, [claims]);
  const siblings = useMemo(() => claims.filter((c) => weakest && c.id !== weakest.id).slice(0, 2), [claims, weakest]);
  // ponytail: live nodes carry no coords — deterministic spiral keeps minimap honest.
  const dots = useMemo(() => {
    if (!g.nodes.length) return [];
    const hasXY = g.nodes.some((n: any) => typeof n.x === "number" && typeof n.y === "number");
    if (hasXY) {
      const xs = g.nodes.map((n: any) => n.x ?? 0), ys = g.nodes.map((n: any) => n.y ?? 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      return g.nodes.slice(0, 60).map((n: any) => ({ x: 10 + ((Number(n.x) || 0) - minX) / Math.max(1, maxX - minX) * 180, y: 10 + ((Number(n.y) || 0) - minY) / Math.max(1, maxY - minY) * 100, s: n.status }));
    }
    return g.nodes.slice(0, 60).map((n: any, i: number) => {
      const a = i * 2.39996, r = 8 + Math.sqrt(i) * 9;
      return { x: 100 + r * Math.cos(a) * 1.6, y: 60 + r * Math.sin(a), s: n.status };
    });
  }, [g]);
  const dotColor = (s: string) => (s === "verified" ? "#2e7d32" : s === "supported" ? "#5a9a3a" : s === "disputed" ? "#b7791f" : "#a33a3a");
  const body: string = article?.abstract ?? "";
  const secs: any[] = article?.sections ?? [];

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <div className="r-side w-full lg:w-[270px] shrink-0 bg-[#e8e0c5] border-r-[2px] border-[#8a7f68] flex flex-col">
        <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 flex items-center justify-between"><span>Contents</span><span className="bg-[#c9a227] text-black px-1 text-[9px] border border-black">TREE</span></div>
        <div className="p-2 space-y-0.5 overflow-auto max-h-[300px] lg:max-h-none">
          {sections.map((s)=><button key={s.id} onClick={()=>{setActive(s.id); refs.current[s.id]?.scrollIntoView({behavior:"smooth",block:"start"});}} className={`w-full text-left px-1.5 py-1 text-[12px] flex items-start gap-1.5 border ${active===s.id?"bg-[#0a2a5e] text-white border-[#0a2a5e]":"bg-transparent border-transparent hover:bg-[#d6cfae]"}`}><span className="mt-0.5">{s.icon}</span><span className="flex-1 leading-[1.25]">{s.label}</span>{(s as any).badge&&<span className="text-[8px] bg-red-700 text-white px-1 border border-black font-bold">{(s as any).badge}</span>}</button>)}
        </div>
        <div className="mt-2 mx-2 border-[2px] bg-[#efe9d5] p-2" style={{ borderStyle:"inset",borderColor:"#fff #8a7f68 #8a7f68 #fff" }}>
          <div className="text-[10px] font-bold text-[#0a2a5e] uppercase tracking-wide mb-1">Mini Atlas</div>
          <svg viewBox="0 0 200 120" className="w-full h-[90px] bg-[#c8e6ff] border border-[#8a7f68]">
            <path d="M60 10 Q80 5 110 15 T140 40 Q145 70 120 95 T70 100 Q45 80 40 50 T60 10" fill="#e2d2a0" stroke="#8a7f68" strokeWidth={1.2}/>
            {dots.map((d: { x: number; y: number; s: string }, i: number) => <circle key={i} cx={d.x} cy={d.y} r={2.4} fill={dotColor(d.s)} stroke="black" strokeWidth={0.4} />)}
            <text x={10} y={110} fontSize={6} fontFamily="Verdana" fill="#0a2a5e">{g.nodes.length} claims • {g.edges.length} edges</text>
          </svg>
        </div>
        <div className="mt-2 mx-2 border-[2px] bg-[#ffffe1] p-2" style={{ borderStyle:"outset",borderWidth:2 }}>
          <div className="text-[10px] font-bold bg-[#c9a227] text-black px-1 inline-block border border-black mb-1">WORD OF THE DAY</div>
          <div className="text-[12px] font-bold" style={{ fontFamily:"Georgia" }}>pis·ci·vore</div>
          <div className="text-[10px] leading-[1.3] mt-0.5"><i>n.</i> Fish-eater. The article&apos;s central adaptation.</div>
        </div>
        <div className="mt-auto p-2 text-[9px] text-[#666] border-t border-[#8a7f68]">Article: {article?.slug ?? "—"} • {claims.length} claims</div>
      </div>

      <div className="flex-1 min-w-0 bg-[#efe9d5] flex flex-col">
        <div className="bg-white m-1.5 sm:m-2 flex-1 overflow-auto r-scroll" style={{ borderStyle:"inset",borderWidth:3,borderColor:"#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
          <div className="max-w-[720px] mx-auto p-4 sm:p-6">
            <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
              <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">{(article?.categories ?? []).join(" • ") || "Encyclopedia • Evidence"}</div>
              <h1 className="r-h1 mt-1">{article?.title ?? "Untitled"}</h1>
              <div className="text-[12px] text-[#555] mt-1 italic">{body.slice(0,160)}</div>
            </div>
            <section ref={(el)=>{refs.current.overview=el;}} id="overview" className="mb-8 scroll-mt-4">
              <h2 className="r-h2"><span>1</span> Overview</h2>
              <div className="mt-3 r-body"><span className="r-drop">{body.slice(0,1)}</span>{body.slice(1) || "No abstract in mock. Generate the article to populate this living document."}
                <div className="border-l-[4px] border-[#c9a227] bg-[#fdf8e8] p-3 my-3 text-[12px] leading-[1.5]" style={{ fontFamily:"Verdana" }}><b className="text-[#0a2a5e]">Why it matters:</b> Every claim below is traced to evidence in the explorer.</div>
              </div>
            </section>
            <section ref={(el)=>{refs.current.discovery=el;}} id="discovery" className="mb-8 scroll-mt-4">
              <h2 className="r-h2"><span>2</span> Sections</h2>
              <div className="mt-3 r-body">{secs.length===0?"Sections appear after generation. Mock shows abstract only.":secs.map((s:any)=><div key={s.id} className="mb-4"><b>{s.title}</b><br/>{s.content}</div>)}</div>
            </section>
            <section ref={(el)=>{refs.current.anatomy=el;}} id="anatomy" className="mb-8 scroll-mt-4">
              <h2 className="r-h2"><span>3</span> Claims ({claims.length})</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ fontFamily:"Verdana" }}>
                {claims.slice(0,4).map((c:any)=><div key={c.id} className="border bg-[#efe9d5] p-2"><b>{c.status}</b> {(c.derived_confidence*100|0)}%<br/>{String(c.text).slice(0,90)}…</div>)}
                {claims.length===0&&<div className="border bg-[#efe9d5] p-2 col-span-2">No claims yet — epistemic pipeline pending.</div>}
              </div>
            </section>
            <section ref={(el)=>{refs.current.debate=el;}} id="debate" className="mb-8 scroll-mt-4 border-[3px] border-[#c9a227] bg-[#fffef6] p-2" style={{ borderStyle:"ridge",borderWidth:3 }}>
              <div className="flex items-center gap-2 mb-2"><h2 className="text-[15px] font-bold bg-[#a33] text-white px-2 py-1 inline-flex items-center gap-2"><span>4</span> The Debate</h2><span className="text-[9px] bg-[#a33] text-white px-1.5 py-0.5 font-bold border border-black animate-pulse">CONTROVERSY • ACTIVE</span></div>
              <div className="border-[3px] bg-[#d4d0c8] p-2" style={{ borderStyle:"ridge" }}>
                <div className="flex items-center justify-between bg-[#0a2a5e] text-white px-2 py-1 mb-2"><div className="text-[11px] font-bold">🔬 Encarta Researcher: Claim Explorer</div><div className="text-[9px] bg-[#c9a227] text-black px-1 border border-black">INTERACTIVE • DRAG &amp; CLICK</div></div>
                {g.nodes.length>0?<ClaimExplorer nodes={g.nodes} edges={g.edges}/>:<div className="text-[11px] bg-white border p-3">No claim graph yet — generate the article to seed it.</div>}
              </div>
            </section>
            {gaps.length > 0 && (
              <section id="gaps" className="mb-8 scroll-mt-4">
                <h2 className="r-h2"><span>5</span> Open gaps ({gaps.length})</h2>
                <div className="mt-2 space-y-2">
                  {gaps.slice(0, 4).map((gp: any) => (
                    <div key={gp.id} className="border-l-[4px] border-[#c9a227] bg-[#fdf8e8] p-2 text-[11px]">
                      <b>{gp.gap_type ?? "gap"}</b> — {gp.expected_artifact ?? ""}<br />
                      <span className="text-[#555]">{gp.cause_label ?? gp.verification_status ?? ""}{typeof gp.cause_confidence === "number" ? ` (${(gp.cause_confidence * 100).toFixed(0)}%)` : ""}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {fresh && (
              <section id="freshness" className="mb-8 scroll-mt-4">
                <h2 className="r-h2"><span>6</span> Freshness ({typeof fresh.overall_score === "number" ? `${(fresh.overall_score * 100).toFixed(0)}%` : "—"})</h2>
                <div className="mt-2 space-y-1">
                  {(fresh.claim_freshness ?? []).slice(0, 4).map((f: any) => (
                    <div key={f.claim_id} className="flex items-center gap-2 text-[10px] text-[#555]"><span className="flex-1 truncate">{f.text ?? f.claim_id}</span><span className="w-20 h-[6px] bg-[#efe9d5] border border-[#8a7f68]"><span className="block h-full bg-[#0a2a5e]" style={{ width: `${(f.freshness_score * 100).toFixed(0)}%` }} /></span><span className="tabular-nums">{f.evidence_count ?? 0} ev</span></div>
                  ))}
                </div>
              </section>
            )}
            <section ref={(el)=>{refs.current.related=el;}} id="related" className="mb-4 scroll-mt-4">
              <h2 className="r-h2"><span>7</span> Quiz</h2>
              <div className="bg-white border mt-2 p-2 text-[11px]">
                <div className="font-bold mb-1">Which claim is the weakest link?</div>
                {weakest ? [weakest, ...siblings].map((o: any, i: number) => {
                  const correct = o.id === weakest.id;
                  return <button key={o.id} onClick={() => setQ1(i)} className={`w-full text-left px-2 py-1 border mb-1 ${q1 === i ? (correct ? "bg-[#e6f4ea] border-[#2e7d32]" : "bg-[#fde8e8] border-[#a33]") : "bg-[#efe9d5] border-[#8a7f68] hover:bg-white"}`}>{String.fromCharCode(65 + i)}. {String(o.text ?? o.id).slice(0, 90)} {q1 === i && (correct ? "✓ weakest" : "✗")}</button>;
                }) : ["Single anecdote", "Converging evidence", "Assertion"].map((o,i)=><button key={o} onClick={()=>setQ1(i)} className={`w-full text-left px-2 py-1 border mb-1 ${q1===i?(i===1?"bg-[#e6f4ea] border-[#2e7d32]":"bg-[#fde8e8] border-[#a33]"):"bg-[#efe9d5] border-[#8a7f68] hover:bg-white"}`}>{String.fromCharCode(65+i)}. {o} {q1===i&&(i===1?"✓":"✗")}</button>)}
                {q1 !== null && <div className="text-[10px] bg-[#ffffe1] border p-1 mt-1">{weakest ? (q1 === 0 ? `Correct — "${String(weakest.text).slice(0, 80)}…" needs evidence. Upvote its gap.` : "Not quite — the first option is the lowest-confidence claim.") : (q1 === 1 ? "Correct — convergence beats anecdote." : "Not quite — look for converging lines in the explorer.")}</div>}
              </div>
            </section>
            <div className="border-t-[2px] border-[#0a2a5e] pt-2 text-[10px] text-[#666] flex justify-between"><span>© Encarta 98 • {article?.slug}</span><span>🔒 Protected Mode</span></div>
          </div>
        </div>
      </div>

      <div className="r-side w-full lg:w-[340px] shrink-0 bg-[#e8e0c5] border-l-[2px] border-t-[2px] lg:border-t-0 border-[#8a7f68] flex flex-col gap-2 p-2 overflow-auto">
        <div className="border-[2px] bg-[#efe9d5]" style={{ borderStyle:"outset",borderWidth:2 }}>
          <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-0.5 flex justify-between items-center"><span>Image Viewer</span><span className="bg-[#c9a227] text-black text-[8px] px-1 border border-black">1 OF 1</span></div>
          <div className="relative group cursor-zoom-in" onClick={()=>setZoom(true)}>
            <div className="w-full h-[210px] bg-[#0a2a5e] text-[#c9e0ff] flex items-center justify-center text-[12px] font-bold p-4 text-center">{article?.title ?? "No image in mock"}</div>
            <div className="absolute top-1 right-1 bg-white border border-black text-[9px] px-1">🔍 Zoom</div>
          </div>
          <div className="p-2 text-[11px] leading-[1.35]"><b>Fig. 1:</b> {body.slice(0,120)}…</div>
        </div>
        <div className="border-[2px] bg-[#ffffe1] p-2" style={{ borderStyle:"outset" }}>
          <div className="text-[10px] font-bold bg-[#c9a227] text-black inline-block px-1 border border-black mb-1">DID YOU KNOW?</div>
          <ul className="text-[11px] list-disc ml-4 space-y-1 leading-[1.35]"><li>Confidence is derived from converging evidence, not assertion.</li><li>Contradictions are first-class — click red edges.</li></ul>
        </div>
        <div className="border-[2px] bg-white p-2" style={{ borderStyle:"inset",borderColor:"#fff #8a7f68 #8a7f68 #fff" }}>
          <div className="text-[11px] font-bold text-[#0a2a5e] border-b border-[#0a2a5e] pb-0.5 mb-1">Related Articles</div>
          <div className="text-[11px] space-y-1">{(article?.crossrefs ?? []).slice(0,4).map((c:any)=><div key={c.id||c.title} className="text-[#0a2a5e] underline">• {c.title}</div>)}{(article?.crossrefs??[]).length===0&&<div className="text-[#555]">No crossrefs in mock.</div>}</div>
        </div>
        <div className="text-[9px] text-center text-[#8a7f68] py-1">Encarta 98 • Premium Edition</div>
      </div>
      {zoom&&<div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={()=>setZoom(false)}><div className="bg-[#efe9d5] border-[3px] max-w-[900px] w-full" style={{ borderStyle:"outset",borderColor:"#fff8e0 #8a7f68 #8a7f68 #fff8e0" }} onClick={(e)=>e.stopPropagation()}><div className="h-[20px] bg-[#0a2a5e] text-white text-[11px] font-bold flex items-center justify-between px-2"><span>{article?.title}</span><button onClick={()=>setZoom(false)} className="w-[14px] h-[12px] bg-[#d4d0c8] text-black border text-[9px] flex items-center justify-center" style={{ borderStyle:"outset",borderWidth:1 }}>X</button></div><div className="p-6 text-[13px] bg-black text-white">{body}</div></div></div>}
    </div>
  );
}
