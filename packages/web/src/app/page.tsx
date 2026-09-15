"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useArticles, useFeaturedArticles, useHealth } from "./hooks";

// ponytail: home is a reference desk — masthead, search, featured, latest, stats. No marketing.
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data: health } = useHealth();
  const { data: featured } = useFeaturedArticles();
  const { data: latest, loading: latestLoading } = useArticles(0, 6);

  const feat = (featured ?? [])[0] ?? null;
  const latestList = (latest as any)?.data ?? [];
  const articles = Array.isArray(latestList) ? latestList.slice(0, 6) : [];

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/articles?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      {/* Masthead */}
      <div className="text-center border-b-[3px] border-double border-[#0a2a5e] pb-3 mb-4" style={{ borderBottomWidth: 5 }}>
        <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#8a7f68" }}>
          {fmtDate(new Date())} • {health?.article_count ?? "—"} articles in the corpus
        </div>
        <h1 className="mt-1 font-bold text-[#0a2a5e]" style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: "clamp(2rem, 1.2rem + 3vw, 3rem)", lineHeight: 1 }}>
          TruthSeekers
        </h1>
        <p className="text-[12px] italic mt-1" style={{ color: "#555", fontFamily: "Georgia,serif" }}>
          The living encyclopedia — every claim sourced, every source checked.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={submitSearch} className="mb-5" role="search" aria-label="Search the encyclopedia">
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles, claims, topics…"
            aria-label="Search articles"
            className="flex-1 min-w-0 basis-full sm:basis-auto bg-white text-black text-[13px] px-3 py-2"
            style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
          />
          <button type="submit" disabled={!q.trim()} className="r-btn px-4 py-2 font-bold disabled:opacity-40 min-h-[40px]">Search</button>
          <button type="button" onClick={() => router.push("/chat/new")} className="r-btn px-4 py-2 font-bold min-h-[40px]">Research →</button>
        </div>
      </form>

      {/* Featured */}
      <section aria-label="Featured article" className="mb-5 border-[2px] bg-[#fdf8e8]" style={{ borderStyle: "outset", borderWidth: 2 }}>
        <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 flex items-center justify-between">
          <span>FEATURED ARTICLE</span>
          <span className="bg-[#c9a227] text-black text-[9px] px-1 border border-black">EDITOR&apos;S PICK</span>
        </div>
        <div className="p-4">
          {feat ? (
            <>
              <Link href={`/article/${(feat as any).slug}`} className="text-[20px] font-bold text-[#0a2a5e] leading-tight" style={{ fontFamily: "Georgia,serif" }}>
                {(feat as any).title}
              </Link>
              <p className="r-body mt-2">
                <span className="r-drop">{String((feat as any).abstract ?? "").slice(0, 1)}</span>
                {String((feat as any).abstract ?? "").slice(1, 320)}
                {String((feat as any).abstract ?? "").length > 320 ? "…" : ""}
              </p>
              <div className="mt-3">
                <Link href={`/article/${(feat as any).slug}`} className="r-btn inline-block px-3 py-1 no-underline text-black">Read article →</Link>
              </div>
            </>
          ) : (
            <div className="text-[12px]" style={{ color: "#555" }}>
              No featured article yet. <Link href="/article/new" className="underline">Generate one</Link> to open the front page.
            </div>
          )}
        </div>
      </section>

      {/* Latest */}
      <section aria-label="Latest articles" className="mb-5">
        <h2 className="r-h2"><span>●</span> Latest articles</h2>
        <div className="mt-2 space-y-1.5">
          {latestLoading && <div className="text-[11px] py-4 text-center" style={{ color: "#8a7f68" }}>Consulting the stacks…</div>}
          {!latestLoading && articles.length === 0 && (
            <div className="text-[11px] py-6 text-center border-[2px] bg-[#ffffe1]" style={{ borderStyle: "outset" }}>The shelves are empty — <Link href="/article/new" className="underline">write the first article</Link>.</div>
          )}
          {articles.map((a: any, i: number) => (
            <Link key={a.slug ?? i} href={`/article/${a.slug}`} className="block bg-white border-[2px] p-2 no-underline hover:bg-[#fff8dc]" style={{ borderStyle: "outset" }}>
              <span className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: "#8a7f68" }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[13px] font-bold text-[#0a2a5e] leading-snug min-w-0 flex-1" style={{ fontFamily: "Georgia,serif" }}>{a.title}</span>
                {a.metadata?.updated && (
                  <span className="ml-auto text-[10px] tabular-nums shrink-0" style={{ color: "#8a7f68" }}>
                    {new Date(a.metadata.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-right">
          <Link href="/articles" className="text-[11px] font-bold text-[#0a2a5e] underline">Browse all articles →</Link>
        </div>
      </section>

      {/* Colophon */}
      <footer className="border-t-[2px] border-[#0a2a5e] pt-2 pb-1 text-[10px] flex flex-wrap gap-x-3 gap-y-1 items-center" style={{ color: "#8a7f68" }}>
        <span>Every article is researched and sourced.</span>
        <span className="ml-auto flex gap-2">
          <Link href="/claim-graph" className="underline">Claim Map</Link>•
          <Link href="/contested" className="underline">Contested</Link>•
          <Link href="/gaps" className="underline">Open Questions</Link>•
          <Link href="/stale" className="underline">Stale Watch</Link>
        </span>
      </footer>
    </>
  );
}
