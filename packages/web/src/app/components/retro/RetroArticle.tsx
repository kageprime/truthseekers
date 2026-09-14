"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RetroContentsNav from "./RetroContentsNav";
import ClaimExplorer from "./ClaimExplorer";
import RetroInspector from "./RetroInspector";
import RetroMarkdown from "./RetroMarkdown";
import { IconBone, IconBook, IconClose, IconFlask, IconLock, IconMountain, IconQuestion, IconScale, IconSearch } from "./icons";
import { retroStatusColor } from "@/lib/retro";
import { canSeeAdmin } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { useArticleProgress, useAuth, useRefreshArticle, useRefreshDiff } from "../../hooks";
import ContestDialog from "../ContestDialog";

const ANCHOR_RE = /\[claim:([^\]]+)\]/g;

function splitAnchors(text: string): Array<{ t: "text"; v: string } | { t: "claim"; v: string }> {
  const out: Array<{ t: "text"; v: string } | { t: "claim"; v: string }> = [];
  let last = 0; ANCHOR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANCHOR_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    out.push({ t: "claim", v: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

export default function RetroArticle({ article, epistemic, graph }: { article: any; epistemic: any; graph: { nodes: any[]; edges: any[] } | null }) {
  const sections = [
    { id: "overview", label: "Overview", Icon: IconBook },
    { id: "discovery", label: article?.title ? `About ${article.title}` : "Discovery", Icon: IconMountain },
    { id: "anatomy", label: "Evidence & Anatomy", Icon: IconBone },
    { id: "debate", label: "The Debate", Icon: IconScale, badge: "CONTROVERSY" },
    { id: "related", label: "Related & Quiz", Icon: IconQuestion },
  ];
  const [active, setActive] = useState("overview");
  const [zoom, setZoom] = useState(false);
  const [q1, setQ1] = useState<number|null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [explorerSel, setExplorerSel] = useState<string | null>(null);
  // ponytail: article actions — contest, regenerate, what-changed. Same
  // hooks/endpoints as the modern ArticleClient; no new backend.
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [contestOpen, setContestOpen] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  // ponytail: claim graph minimized by default — conditional mount avoids canvas cost until expanded.
  const [showGraph, setShowGraph] = useState(false);
  const [regen, setRegen] = useState<string | null>(null);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  const { mutate: refreshMutate, loading: refreshLoading } = useRefreshArticle();
  const { data: diff } = useRefreshDiff(article?.slug);
  const diffCount = (diff?.upgraded ?? 0) + (diff?.downgraded ?? 0) + (diff?.status_changed ?? 0);
  useArticleProgress(regen !== null ? article?.slug ?? null : null, regen !== null, {
    onPhase: (p) => setRegen(p === "done" ? null : p),
    onDone: () => {
      setRegen(null);
      setRegenMsg("Regeneration complete — article updated.");
      queryClient.invalidateQueries({ queryKey: ["article", article?.slug] });
    },
    onError: (e) => {
      setRegen(null);
      setRegenMsg(`Regeneration failed: ${e}`);
    },
  });
  const handleRegen = () => {
    if (!article?.slug || regen !== null) return;
    setRegenMsg(null);
    // ponytail: refreshArticle resolves undefined on transport failure and
    // {status:"error"|"busy"} on refusal — every path gets visible feedback.
    refreshMutate(article.slug).then((r) => {
      if (!r) setRegenMsg("Regeneration failed to start — is the API reachable?");
      else if ((r as any).status === "busy") setRegenMsg(`Backend busy: ${(r as any).error || "a generation is already running"}`);
      else if ((r as any).status === "error") setRegenMsg("Regeneration refused — check quota and try again.");
      else setRegen("queued");
    });
  };
  const chipReturn = useRef<HTMLElement | null>(null);
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

  const body: string = article?.abstract ?? "";
  const secs: any[] = article?.sections ?? [];

  const heroImage = useMemo(() => {
    if (article?.sections?.[0]?.media?.[0]?.src) return article.sections[0].media[0].src;
    for (const s of secs) {
      if (s?.media?.[0]?.src) return s.media[0].src;
    }
    return null;
  }, [article, secs]);

  const claimsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of claims) if (c?.id) m.set(c.id, c);
    for (const n of g.nodes) if (n.type === "claim" && !m.has(n.id)) m.set(n.id, { id: n.id, text: n.label, status: n.status, derived_confidence: n.confidence });
    return m;
  }, [claims, g]);

  const anchorNums = useMemo(() => {
    const map: Record<string, number> = {}; let n = 0;
    const walk = (t: string) => { for (const p of splitAnchors(t || "")) if (p.t === "claim" && !(p.v in map)) map[p.v] = ++n; };
    walk(body); for (const s of secs) walk(s.content ?? "");
    return map;
  }, [body, secs]);

  const inspectNode = inspectId ? (g.nodes.find((n: any) => n.id === inspectId) ?? null) : null;
  const openInspect = (id: string, el: HTMLElement | null) => { chipReturn.current = el; setInspectId(id); };
  const closeInspect = () => { setInspectId(null); chipReturn.current?.focus?.(); };
  const showInExplorer = (id: string) => {
    setInspectId(null); setExplorerSel(id); setShowGraph(true);
    refs.current.debate?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!inspectId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeInspect(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inspectId]);

  const MD_RE = /```|\$\$|\\\(|\\\[|^\s*\|.*\|\s*$|^\s*#{1,6}\s/m;
  const sectionBlock = (s: any) => {
    const cited = splitAnchors(s.content ?? "").filter((p) => p.t === "claim").map((p) => (p as { t: "claim"; v: string }).v);
    const stripped = (s.content ?? "").replace(ANCHOR_RE, "").replace(/\s{2,}/g, " ").trim();
    const media = Array.isArray(s.media) ? s.media : [];
    return (
      <div key={s.id} className="mb-6">
        <b style={{ color: "var(--r-accent)" }}>{s.title}</b>
        {media.length > 0 && (
          <div className="my-2.5 border rounded-[var(--r-radius)] overflow-hidden bg-[var(--r-surface-elevated)]" style={{ borderColor: "var(--r-border)" }}>
            {media.map((m: any, idx: number) => (
              <div key={idx} className="p-2">
                {m.src && <img src={m.src} alt={m.caption || s.title} className="w-full max-h-[300px] object-cover rounded-sm border" style={{ borderColor: "var(--r-border)" }} />}
                {m.caption && <div className="text-[11px] mt-1 text-[var(--r-ink-secondary)] italic">{m.caption}</div>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-1.5">{MD_RE.test(s.content ?? "") ? <RetroMarkdown content={stripped} /> : renderRich(s.content)}</div>
        {cited.length > 0 && (
          <div className="mt-2 text-[11px] flex flex-wrap gap-1.5 items-center">
            <span style={{ color: "var(--r-muted)" }}>Cited claims:</span>
            {cited.map((id) => (
              <button key={id} className="r-claim" aria-label={`Inspect cited claim ${anchorNums[id] ?? ""}`} onClick={(e) => openInspect(id, e.currentTarget)}>
                <sup>[{anchorNums[id] ?? "?"}]</sup>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRich = (text: string) => {
    const parts = splitAnchors(text || "");
    if (!parts.some((p) => p.t === "claim")) return <>{text}</>;
    return (
      <>
        {parts.map((p, i) => {
          if (p.t === "text") return <span key={i}>{p.v}</span>;
          const c = claimsById.get(p.v);
          const num = anchorNums[p.v] ?? "?";
          const status = c?.status ?? "unknown";
          const conf = typeof (c?.derived_confidence ?? c?.confidence) === "number" ? ((c.derived_confidence ?? c.confidence) * 100).toFixed(0) + "%" : "—";
          const label = `Claim ${num}: ${status}, confidence ${conf}. Activate to inspect.`;
          return (
            <button
              key={i}
              className="r-claim"
              aria-label={label}
              title={c ? String(c.text ?? p.v).slice(0, 120) : "Unresolved claim reference"}
              onClick={(e) => openInspect(p.v, e.currentTarget)}
            >
              <sup>[{num}]</sup>
              <span className="r-claim-card" aria-hidden>
                <span className="r-claim-head"><span className="r-claim-dot" style={{ background: retroStatusColor(status) }} />Claim [{num}] • {status}</span>
                <span className="r-claim-text">{c ? String(c.text ?? p.v).slice(0, 140) : "Unresolved claim reference."}</span>
                <span className="r-claim-foot">conf {conf} • click to inspect →</span>
              </span>
            </button>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-3">
      {/* ponytail: same Contents nav as every other page, with this
          article's outline injected — no bespoke sidebar. */}
      <RetroContentsNav
        pathname={`/article/${article?.slug ?? ""}`}
        showAdmin={canSeeAdmin(user?.role)}
        outline={sections.map((s) => ({ id: s.id, label: s.label }))}
        activeOutline={active}
        onOutlineSelect={(id) => { setActive(id); refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
      />

      {/* Main Document Reading View (Vintage Book + CD-ROM Mashup) */}
      <div className="flex-1 min-w-0 bg-[var(--r-surface)] flex flex-col rounded-[var(--r-radius)] border border-[var(--r-border)] transition-colors duration-200">
        <div className="r-doc m-1.5 sm:m-2 flex-1 overflow-auto r-scroll p-4 sm:p-8">
          <div className="max-w-[820px] mx-auto">
            {/* Header Plate */}
            <div className="border-b-2 border-[var(--r-accent)] pb-4 mb-6">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--r-muted)]">
                {(article?.categories ?? []).join(" • ") || "Encyclopedia • Evidence Grounded"}
              </div>
              <h1 className="r-h1 mt-1.5">{article?.title ?? "Untitled Article"}</h1>
              {body && <div className="text-[13px] mt-2 italic text-[var(--r-ink-secondary)] leading-relaxed">{body.slice(0, 180)}…</div>}
            </div>

            {/* Action bar — contest, regenerate, what-changed */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button
                className="r-btn"
                onClick={() => setContestOpen((v) => !v)}
                disabled={!user}
                aria-expanded={contestOpen}
                title={user ? "Challenge this article with a counterpoint" : "Log in to contest this article"}
              >
                {contestOpen ? "▾" : "▸"} Contest
              </button>
              <button
                className="r-btn"
                onClick={handleRegen}
                disabled={!user || regen !== null || refreshLoading}
                title={user ? "Regenerate this article" : "Log in to regenerate"}
              >
                {regen !== null ? `⟳ ${regen}…` : "⟳ Regenerate"}
              </button>
              {diffCount > 0 && (
                <button className="r-btn" onClick={() => setShowDiff((v) => !v)} aria-expanded={showDiff}>
                  {showDiff ? "▾" : "▸"} What changed ({diffCount})
                </button>
              )}
            </div>
            {!user && (
              <div className="text-[11px] mb-4" style={{ color: "var(--r-muted)" }}>
                <Link href={`/login?redirect=${encodeURIComponent(`/article/${article?.slug ?? ""}`)}`} className="underline font-bold" style={{ color: "var(--r-accent)" }}>Log in</Link>
                {" "}to contest or regenerate this article.
              </div>
            )}
            {regenMsg && (
              <div className="text-[11px] mb-4" style={{ color: "var(--r-muted)" }}>{regenMsg}</div>
            )}
            {contestOpen && (
              <div className="mb-6">
                <ContestDialog
                  slug={article.slug}
                  open={contestOpen}
                  onClose={() => setContestOpen(false)}
                  onQueued={() => { setContestOpen(false); setRegen("queued"); }}
                  inline
                />
              </div>
            )}

            {showDiff && diffCount > 0 && (
              <div className="mb-6 border bg-[var(--r-surface-elevated)] rounded-[var(--r-radius)] p-3 text-[11px]" style={{ borderColor: "var(--r-border)" }}>
                <div className="font-bold mb-2" style={{ color: "var(--r-accent)" }}>
                  What changed since the last refresh
                  {typeof diff?.total_claims === "number" && (
                    <span className="font-normal" style={{ color: "var(--r-muted)" }}> — {diff.total_claims} claims tracked</span>
                  )}
                </div>
                <div className="space-y-1">
                  {(diff?.claim_diffs ?? []).map((d: any) => {
                    const delta = typeof d.confidence_delta === "number" ? d.confidence_delta : 0;
                    const up = delta > 0.05, down = delta < -0.05;
                    return (
                      <div key={d.claim_id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1 border rounded-sm bg-[var(--r-surface)]" style={{ borderColor: "var(--r-border)" }}>
                        <span aria-hidden>{up ? "▲" : down ? "▼" : "●"}</span>
                        <span className="font-mono font-bold" style={{ color: "var(--r-ink)" }}>{d.claim_id}</span>
                        {d.status_changed ? (
                          <span style={{ color: "var(--r-ink-secondary)" }}>{d.old_status} → <b>{d.new_status}</b></span>
                        ) : (
                          <span style={{ color: "var(--r-muted)" }}>{d.new_status ?? d.old_status}</span>
                        )}
                        <span className="ml-auto font-bold tabular-nums" style={{ color: up ? "#2e7d32" : down ? "#a33a3a" : "var(--r-muted)" }}>
                          {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section: Overview */}
            <section ref={(el)=>{refs.current.overview=el;}} id="overview" className="mb-8 scroll-mt-4">
              <h2 className="r-h2">Overview</h2>
              <div className="mt-3 r-body">
                <span className="r-drop">{body.slice(0, 1)}</span>
                {renderRich(body.slice(1)) || "No abstract available. Generate the article to populate this evidence-grounded document."}
                <div className="border-l-4 border-[var(--r-header-accent)] bg-[var(--r-surface-elevated)] p-3 my-4 text-[12px] leading-relaxed rounded-r-sm shadow-sm" style={{ borderLeftColor: "var(--r-header-accent)" }}>
                  <b className="text-[var(--r-accent)]">Epistemic Note:</b> Every claim in this encyclopedia entry is traced back to empirical evidence in the interactive claim explorer.
                </div>
              </div>
            </section>

            {/* Section: Content Sections */}
            <section ref={(el)=>{refs.current.discovery=el;}} id="discovery" className="mb-8 scroll-mt-4">
              <h2 className="r-h2">Detailed Findings</h2>
              <div className="mt-3 r-body">{secs.length===0 ? <div className="text-[13px] italic text-[var(--r-muted)]">Full sections will populate once the 9-node DAG completes.</div> : secs.map(sectionBlock)}</div>
            </section>

            {/* Section: Claims Grid */}
            <section ref={(el)=>{refs.current.anatomy=el;}} id="anatomy" className="mb-8 scroll-mt-4">
              <h2 className="r-h2">Extracted Claims ({claims.length})</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                {claims.slice(0, 6).map((c: any) => (
                  <div key={c.id} className="border bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] shadow-sm" style={{ borderColor: "var(--r-border)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <b className="uppercase text-[9px] tracking-wide" style={{ color: retroStatusColor(c.status) }}>{c.status}</b>
                      <span className="font-bold text-[10px] text-[var(--r-muted)]">{(c.derived_confidence * 100 | 0)}% conf</span>
                    </div>
                    <div className="text-[var(--r-ink)] leading-snug">{String(c.text).slice(0, 100)}…</div>
                  </div>
                ))}
                {claims.length === 0 && <div className="border bg-[var(--r-surface-elevated)] p-3 col-span-1 sm:col-span-2 text-[var(--r-muted)] italic">No claims extracted yet.</div>}
              </div>
            </section>

            {/* Section: Interactive Debate & Claim Graph — minimized by default */}
            <section ref={(el)=>{refs.current.debate=el;}} id="debate" className="mb-8 scroll-mt-4 border-2 bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] shadow-sm" style={{ borderColor: "var(--r-accent)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-[14px] font-bold bg-[var(--r-accent)] text-white px-2.5 py-1 rounded-sm inline-flex items-center gap-2">
                  Interactive Claim Graph & Debate
                </h2>
                <span className="text-[9px] bg-amber-700 text-white px-2 py-0.5 font-bold rounded-sm animate-pulse">
                  CONTROVERSY MAP
                </span>
              </div>
              <button className="r-btn mb-2" onClick={() => setShowGraph((v) => !v)} aria-expanded={showGraph}>
                {showGraph ? "▾ Hide claim graph" : `▸ Show claim graph${g.nodes.length > 0 ? ` (${g.nodes.length})` : ""}`}
              </button>
              {showGraph && (
              <div className="border bg-[var(--r-surface)] p-2 rounded-[var(--r-radius)]" style={{ borderColor: "var(--r-border)" }}>
                <div className="flex items-center justify-between bg-[var(--r-accent)] text-white px-2.5 py-1 mb-2 rounded-sm">
                  <div className="text-[11px] font-bold inline-flex items-center gap-1.5"><IconFlask size={13} /> TruthSeekers Explorer</div>
                  <div className="text-[9px] bg-[var(--r-header-accent)] text-black px-1.5 py-0.5 font-bold rounded-sm">INTERACTIVE</div>
                </div>
                {g.nodes.length > 0 ? (
                  <ClaimExplorer nodes={g.nodes} edges={g.edges} selectedId={explorerSel} onSelect={setExplorerSel}/>
                ) : (
                  <div className="text-[11px] bg-[var(--r-surface-elevated)] border p-4 text-center text-[var(--r-muted)] rounded-sm">
                    Generate the article to build the live force-directed claim graph.
                  </div>
                )}
              </div>
              )}
            </section>

            {/* Section: Quiz */}
            <section ref={(el)=>{refs.current.related=el;}} id="related" className="mb-4 scroll-mt-4">
              <h2 className="r-h2">Epistemic Quiz</h2>
              <div className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] mt-3 p-3 rounded-[var(--r-radius)] text-[12px]">
                <div className="font-bold mb-2 text-[var(--r-ink)]">Which claim is the weakest link?</div>
                {weakest ? [weakest, ...siblings].map((o: any, i: number) => {
                  const correct = o.id === weakest.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setQ1(i)}
                      className={`w-full text-left px-3 py-2 border mb-1.5 rounded-[var(--r-radius)] transition-colors ${
                        q1 === i
                          ? (correct ? "bg-emerald-50 text-emerald-900 border-emerald-600 font-medium" : "bg-red-50 text-red-900 border-red-500")
                          : "bg-[var(--r-surface)] border-[var(--r-border)] hover:bg-black/5 text-[var(--r-ink)]"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {String(o.text ?? o.id).slice(0, 100)} {q1 === i && (correct ? "✓ (weakest link)" : "✗")}
                    </button>
                  );
                }) : ["Single anecdote", "Converging evidence", "Unsubstantiated assertion"].map((o, i) => (
                  <button
                    key={o}
                    onClick={() => setQ1(i)}
                    className={`w-full text-left px-3 py-2 border mb-1.5 rounded-[var(--r-radius)] transition-colors ${
                      q1 === i
                        ? (i === 1 ? "bg-emerald-50 text-emerald-900 border-emerald-600 font-medium" : "bg-red-50 text-red-900 border-red-500")
                        : "bg-[var(--r-surface)] border-[var(--r-border)] hover:bg-black/5 text-[var(--r-ink)]"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {o} {q1 === i && (i === 1 ? "✓" : "✗")}
                  </button>
                ))}
              </div>
            </section>

            <div className="border-t border-[var(--r-border)] pt-3 text-[10px] text-[var(--r-muted)] flex justify-between">
              <span>© TruthSeekers • {article?.slug ?? "encyclopedia"}</span>
              <span className="inline-flex items-center gap-1"><IconLock size={11} /> Evidence Grounded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Figure Plates & Related */}
      <div className="r-side w-full lg:w-[320px] shrink-0 bg-[var(--r-nav-bg)] border border-[var(--r-border)] rounded-[var(--r-radius)] flex flex-col gap-3 p-3 transition-colors duration-200">
        {/* Figure Plate */}
        <div className="border bg-[var(--r-surface-elevated)] rounded-[var(--r-radius)] overflow-hidden shadow-sm" style={{ borderColor: "var(--r-border)" }}>
          <div className="bg-[var(--r-accent)] text-white text-[11px] font-bold px-3 py-1 flex justify-between items-center">
            <span>Figure Plate</span>
            <span className="bg-[var(--r-header-accent)] text-black text-[8px] font-bold px-1.5 py-0.5 rounded-sm">FIG. 1</span>
          </div>
          <div className="relative group cursor-zoom-in" onClick={() => setZoom(true)}>
            {heroImage ? (
              <img src={heroImage} alt={article?.title} className="w-full h-[180px] object-cover" />
            ) : (
              <div className="w-full h-[180px] bg-[var(--r-accent)] text-white flex items-center justify-center text-[12px] font-bold p-4 text-center">
                {article?.title ?? "Illustration Placeholder"}
              </div>
            )}
            <div className="absolute top-2 right-2 bg-white text-black border border-black text-[9px] px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1 shadow-sm">
              <IconSearch size={10} /> Zoom
            </div>
          </div>
          <div className="p-2.5 text-[11px] leading-relaxed text-[var(--r-ink-secondary)]">
            <b>Fig. 1:</b> {body ? body.slice(0, 110) + "…" : "Illustration plate representing the evidence-grounded analysis."}
          </div>
        </div>

        {/* Fact Box */}
        <div className="border bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] shadow-sm" style={{ borderColor: "var(--r-border)" }}>
          <div className="text-[9px] font-bold bg-[var(--r-header-accent)] text-black inline-block px-1.5 py-0.5 border border-black/30 mb-2 rounded-sm uppercase tracking-wide">
            DID YOU KNOW?
          </div>
          <ul className="text-[11px] list-disc ml-4 space-y-1.5 leading-snug text-[var(--r-ink-secondary)]">
            <li>Epistemic confidence is derived from converging multi-source evidence, not single assertions.</li>
            <li>Contradictions are mapped as first-class edges in the DAG.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
