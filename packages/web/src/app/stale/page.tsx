"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchStaleArticles } from "@/lib/api";

interface StaleArticle {
  slug: string;
  title: string;
  freshness_score: number;
  claim_count: number;
  updated: string;
}

export default function StalePage() {
  const [articles, setArticles] = useState<StaleArticle[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaleArticles(50).then((res) => {
      if (res) setArticles(res.articles as StaleArticle[]);
    }).finally(() => setLoading(false));
  }, []);

  const freshColor = (score: number) =>
    score > 0.66 ? "#4a8f5a" : score > 0.33 ? "#b87a2e" : "#b33c3c";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-serif mb-2 text-ink">Stale Articles</h1>
      <p className="text-xs text-subtle mb-8">
        Articles ranked by evidence freshness. The further down the list, the more likely the
        evidence needs re-verification. Click any article to read or refresh it.
      </p>

      {loading && <div className="text-xs text-subtle">Loading...</div>}

      {!loading && (!articles || articles.length === 0) && (
        <div className="text-xs text-subtle py-8 text-center">No articles tracked.</div>
      )}

      {articles && articles.length > 0 && (
        <div className="space-y-1.5">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/article/${a.slug}`}
              className="block p-3 rounded border hover:border-opacity-100 transition-colors"
              style={{ borderColor: "var(--border, #e5e5e5)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{a.title}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--muted, #777)" }}>
                    {a.claim_count} claims
                    {a.updated && (
                      <span>
                        {" "}
                        · updated{" "}
                        {new Date(a.updated).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: freshColor(a.freshness_score),
                      background: freshColor(a.freshness_score) + "14",
                    }}
                  >
                    {(a.freshness_score * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
