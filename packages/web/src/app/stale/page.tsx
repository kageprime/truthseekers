"use client";

import Link from "next/link";
import { useStaleArticles } from "../hooks";
import { useUiMode } from "../context/UiModeContext";

interface StaleArticle {
  slug: string;
  title: string;
  freshness_score: number;
  claim_count: number;
  updated: string;
}

export default function StalePage() {
  const { data: res, loading } = useStaleArticles(50);
  const { widthMode } = useUiMode();
  const articles = (res?.articles as StaleArticle[] | undefined) ?? [];

  const freshTone = (score: number) =>
    score > 0.66 ? "bg-forest" : score > 0.33 ? "bg-gold" : "bg-oxblood";
  const freshText = (score: number) =>
    score > 0.66 ? "text-forest" : score > 0.33 ? "text-gold" : "text-oxblood";

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} mx-auto transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Maintenance</span>
            <span>Stalest first</span>
          </div>
          <h1 className="plate-title">Stale watch</h1>
          <p className="plate-deck">
            100% means verified today; evidence decays over roughly six months.
            Select an article to read or refresh it.
          </p>
          <div className="plate-rule" />
        </div>

        <div className="py-6">
          {loading && (
            <p className="font-serif italic text-muted py-8 text-center">Checking dates…</p>
          )}

          {!loading && articles.length === 0 && (
            <p className="font-serif italic text-muted py-8 text-center">No articles tracked.</p>
          )}

          {articles.length > 0 && (
            <div className="ledger">
              {articles.map((a, i) => {
                const pct = Math.max(0, Math.min(1, a.freshness_score)) * 100;
                return (
                  <Link key={a.slug} href={`/article/${a.slug}`} className="ledger-row group">
                    <span className="index-numeral">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-lg font-semibold text-ink group-hover:text-gold transition-colors truncate">
                        {a.title}
                      </span>
                      <span className="block text-xs text-muted tabular-nums mt-0.5">
                        {a.claim_count} claims
                        {a.updated && (
                          <> · updated {new Date(a.updated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</>
                        )}
                      </span>
                      <span className="block mt-2 h-[3px] bg-ink/10 max-w-[280px]" aria-hidden>
                        <span className={`block h-full ${freshTone(a.freshness_score)}`} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className={`font-mono text-sm tabular-nums shrink-0 ${freshText(a.freshness_score)}`}>
                      {(a.freshness_score * 100).toFixed(0)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
