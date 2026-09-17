"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useArticles, useFeaturedArticles, useHealth } from "./hooks";
import DomainCard from "./components/portal/DomainCard";
import { useUiMode } from "./context/UiModeContext";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: health } = useHealth();
  const { data: featured } = useFeaturedArticles();
  const { data: latestRes, loading: latestLoading } = useArticles(0, 9);
  const { widthMode } = useUiMode();

  const feat = (featured ?? [])[0] ?? null;
  const latestList = (latestRes as any)?.data ?? [];
  const articles = Array.isArray(latestList) ? latestList : [];

  const domains = (featured?.length ? featured : articles).slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/article/${encodeURIComponent(query.trim().toLowerCase().replace(/\s+/g, "-"))}`);
    }
  };

  const containerClass = widthMode === "expanded" ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-12 transition-all duration-300`}>
        {/* Masthead Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-medium border border-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Autonomous Epistemic Corpus{health?.article_count ? ` · ${health.article_count} Verified Entries` : ""}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 leading-[1.1]">
            The Living Encyclopedia
          </h1>

          <p className="font-serif text-lg sm:text-xl text-zinc-600 italic leading-relaxed">
            Every claim sourced. Every proposition scrutinized. An autonomous AI agent-driven knowledge repository.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="pt-2 max-w-xl mx-auto" role="search">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-sm focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-900/10 transition-all">
              <span className="pl-3 text-zinc-400 text-base" aria-hidden>⌕</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, claims, empirical topics…"
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 px-2 py-1.5 min-w-0"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                Research →
              </button>
            </div>
          </form>
        </div>

        {/* Curated Domain Portals */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Featured Research Domains
              </h2>
              <p className="text-sm font-bold text-zinc-900 mt-0.5">Explore Verified Epistemic Spaces</p>
            </div>
            <Link
              href="/articles"
              className="text-xs font-semibold text-zinc-900 hover:underline no-underline"
            >
              View all articles →
            </Link>
          </div>

          {domains.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {domains.map((d: any) => (
                <DomainCard
                  key={d.slug}
                  slug={d.slug}
                  title={d.title || d.slug}
                  category={(d.categories?.[0] || "Knowledge").toUpperCase()}
                  abstract={d.abstract || "Autonomous empirical research entry."}
                  sourcesCount={d.citations?.length ?? d.source_count}
                  confidence={d.confidence}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              {latestLoading ? "Loading verified entries…" : "No verified entries yet — generate your first article to seed the corpus."}
            </div>
          )}
        </section>

        {/* Featured Editorial Spotlight */}
        {feat && (
          <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
            <div className="bg-zinc-900 text-white px-5 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">
                Editor&apos;s Feature Choice
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                HIGH EVIDENCE CONSENSUS
              </span>
            </div>
            <div className="p-6 sm:p-8 space-y-4">
              <Link
                href={`/article/${(feat as any).slug}`}
                className="text-2xl sm:text-3xl font-bold text-zinc-900 hover:text-zinc-600 no-underline transition-colors block"
              >
                {(feat as any).title}
              </Link>
              <p className="font-serif text-base text-zinc-700 italic leading-relaxed line-clamp-3">
                {(feat as any).abstract}
              </p>
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {((feat as any).citations?.length ?? (feat as any).source_count) != null
                    ? `${(feat as any).citations?.length ?? (feat as any).source_count} Primary Citations Verified`
                    : "Verified Research Entry"}
                </span>
                <Link
                  href={`/article/${(feat as any).slug}`}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors no-underline"
                >
                  Read Verified Article →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Latest Articles Feed */}
        {articles.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Recently Synthesized Articles
              </h2>
              <span className="text-xs text-zinc-400 font-mono">Live Corpus</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden bg-white shadow-xs">
              {articles.map((a: any, idx: number) => (
                <Link
                  key={a.slug || idx}
                  href={`/article/${a.slug}`}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50/80 transition-colors no-underline group"
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <div className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors truncate">
                      {a.title || a.slug}
                    </div>
                    <div className="text-xs text-zinc-500 line-clamp-1">
                      {a.abstract || "Autonomous empirical research entry."}
                    </div>
                  </div>
                  <span className="text-zinc-400 text-lg group-hover:text-zinc-700 transition-colors shrink-0">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
