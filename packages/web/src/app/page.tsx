"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useArticles, useFeaturedArticles, useHealth } from "./hooks";
import { useUiMode } from "./context/UiModeContext";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: health } = useHealth();
  const { data: featured } = useFeaturedArticles();
  const { data: latestRes, loading: latestLoading } = useArticles(0, 9);
  const { widthMode, alignClass } = useUiMode();

  const feat = (featured ?? [])[0] ?? null;
  const latestList = (latestRes as any)?.data ?? [];
  const articles = Array.isArray(latestList) ? latestList : [];

  // ponytail: keyword desks over the live pool; slice fallback keeps
  // sections populated until the corpus covers finance/law/work.
  const pool = (featured?.length ? [...featured, ...articles] : articles).filter(
    (a: any, i: number, arr: any[]) => a?.slug && arr.findIndex((b: any) => b.slug === a.slug) === i
  );
  const DESKS = [
    { key: "finance", label: "Markets & Finance", hint: "Capital, prices, risk", match: ["financ", "market", "econom", "bank", "money", "trade", "invest"] },
    { key: "law", label: "Law & Policy", hint: "Statutes, courts, reform", match: ["law", "legal", "court", "policy", "regulat", "rights", "govern"] },
    { key: "work", label: "Work & Recruitment", hint: "Labour, hiring, skills", match: ["work", "job", "career", "hiring", "recruit", "labour", "labor", "employ"] },
  ];
  const deskItems = (match: string[]) => {
    const hit = pool.filter((a: any) =>
      `${a.categories?.join(" ") ?? ""} ${a.title ?? ""}`.toLowerCase().includes(match[0]) ||
      match.some((k) => `${a.categories?.join(" ") ?? ""} ${a.title ?? ""} ${a.abstract ?? ""}`.toLowerCase().includes(k))
    );
    return (hit.length ? hit : pool).slice(0, 3);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/article/${encodeURIComponent(query.trim().toLowerCase().replace(/\s+/g, "-"))}`);
    }
  };

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} ${alignClass} transition-all duration-300`}>
        {/* Masthead */}
        <div className="plate-head">
          <div className="plate-folio">
            <span>The Living Encyclopedia</span>
            <span>
              {health?.article_count != null
                ? `${health.article_count} verified entries`
                : "Autonomous epistemic corpus"}
            </span>
          </div>
          <h1 className="plate-title">Truthseekers</h1>
          <p className="plate-deck">
            Every claim sourced. Every proposition scrutinized. An autonomous
            agent-driven knowledge repository.
          </p>
          <form onSubmit={handleSearch} role="search" className="mt-5">
            <div className="flex items-center gap-3 border-b-2 border-ink pb-2 focus-within:border-gold transition-colors">
              <span className="text-subtle text-lg leading-none" aria-hidden>⌕</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, claims, empirical topics…"
                aria-label="Search articles"
                className="flex-1 bg-transparent border-none outline-none font-serif text-lg text-ink placeholder:text-subtle min-w-0"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-gold disabled:opacity-30 disabled:no-underline cursor-pointer shrink-0"
              >
                Research →
              </button>
            </div>
          </form>
          <div className="plate-rule" />
        </div>

        {/* Feature Essay */}
        {feat && (
          <section className="py-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold mb-3">
              Editor&rsquo;s feature
            </div>
            <Link
              href={`/article/${(feat as any).slug}`}
              className="font-display font-bold text-ink no-underline hover:text-gold transition-colors text-balance"
              style={{ fontSize: "clamp(1.9rem, 1.2rem + 3vw, 3rem)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
            >
              {(feat as any).title}
            </Link>
            <p className="font-serif italic text-lg text-muted leading-relaxed mt-3 max-w-2xl line-clamp-3">
              {(feat as any).abstract}
            </p>
            <div className="dateline mt-4">
              {((feat as any).citations?.length ?? (feat as any).source_count) != null && (
                <><span>{(feat as any).citations?.length ?? (feat as any).source_count} primary citations</span><span className="sep">·</span></>
              )}
              <Link href={`/article/${(feat as any).slug}`} className="category-link no-underline font-semibold">
                Read the verified article →
              </Link>
            </div>
          </section>
        )}

        {/* Digest desks — compact multi-story editorial grid, 1-col mobile */}
        <section className="py-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl font-bold text-ink">The digest</h2>
            <Link href="/articles" className="category-link no-underline text-sm font-medium">
              View all →
            </Link>
          </div>
          {pool.length > 0 ? (
            <div className="space-y-8">
              {DESKS.map((desk) => (
                <section key={desk.key} aria-label={desk.label}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold">
                      {desk.label}
                    </h3>
                    <span className="text-[11px] font-mono text-subtle hidden sm:inline">{desk.hint}</span>
                  </div>
                  <div className="digest-grid">
                    {deskItems(desk.match).map((d: any) => (
                      <Link key={`${desk.key}-${d.slug}`} href={`/article/${d.slug}`} className="digest-card group">
                        <span className="digest-kicker">{(d.categories?.[0] || desk.label).toUpperCase()}</span>
                        <span className="block font-display text-[17px] font-semibold leading-snug text-ink group-hover:text-gold transition-colors text-balance">
                          {d.title || d.slug}
                        </span>
                        <span className="block font-serif italic text-[13px] text-muted leading-relaxed line-clamp-2">
                          {d.abstract || "Autonomous empirical research entry."}
                        </span>
                        <span className="dateline mt-auto pt-1">
                          <span>{d.citations?.length ?? d.source_count ?? "—"} sources</span>
                          <span className="sep">·</span>
                          <span className="underline decoration-gold decoration-2 underline-offset-4">Read →</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="font-serif italic text-muted">
              {latestLoading ? "Loading verified entries…" : "No verified entries yet — generate your first article to seed the corpus."}
            </p>
          )}
          <p className="digest-disclosure mt-6">
            Unofficial edited digest — AI-synthesized summaries. Verify claims against the linked primary sources before citing.
          </p>
        </section>

        {articles.length > 0 && (
          <>
            <div className="fleuron" aria-hidden>❦</div>
            <section className="py-8">
              <h2 className="font-display text-2xl font-bold text-ink mb-4">Recently synthesized</h2>
              <div className="ledger">
                {articles.map((a: any) => (
                  <Link key={a.slug} href={`/article/${a.slug}`} className="ledger-row group">
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-[15px] text-ink group-hover:text-gold transition-colors truncate">
                        {a.title || a.slug}
                      </span>
                      <span className="block text-[13px] text-muted truncate mt-0.5">
                        {a.abstract || "Autonomous empirical research entry."}
                      </span>
                    </span>
                    <span className="text-subtle group-hover:text-gold transition-colors shrink-0" aria-hidden>›</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
