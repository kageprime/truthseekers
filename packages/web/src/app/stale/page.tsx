"use client";

import Link from "next/link";
import { useStaleArticles } from "../hooks";

interface StaleArticle {
  slug: string;
  title: string;
  freshness_score: number;
  claim_count: number;
  updated: string;
}

export default function StalePage() {
  const { data: res, loading } = useStaleArticles(50);
  const articles = (res?.articles as StaleArticle[] | undefined) ?? [];

  const freshColor = (score: number) =>
    score > 0.66 ? "#4a8f5a" : score > 0.33 ? "#b87a2e" : "#b33c3c";

  return (
    <>
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">Living Encyclopedia • Maintenance</div>
        <h1 className="r-h1 mt-1" style={{ fontSize: 28 }}>Stale Watch</h1>
        <p className="text-[11px] mt-1" style={{ color: "#555" }}>
          Stalest first. 100% means verified today; evidence decays over ~6 months. Click any article to read or refresh it.
        </p>
      </div>

      {loading && <div className="text-[11px] py-8 text-center" style={{ color: "#8a7f68" }}>Checking dates…</div>}

      {!loading && articles.length === 0 && (
        <div className="text-[11px] py-8 text-center border-[2px] bg-[#ffffe1]" style={{ borderStyle: "outset", borderWidth: 2 }}>No articles tracked.</div>
      )}

      {articles.length > 0 && (
        <div className="space-y-1.5">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/article/${a.slug}`}
              className="block bg-white border-[2px] p-2 no-underline hover:bg-[#fff8dc]"
              style={{ borderStyle: "outset", borderWidth: 2 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#0a2a5e] truncate" style={{ fontFamily: "Georgia,serif" }}>{a.title}</div>
                  <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: "#8a7f68" }}>
                    {a.claim_count} claims
                    {a.updated && (
                      <span>
                        {" "}· updated{" "}
                        {new Date(a.updated).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-[8px] bg-[#efe9d5] border border-[#8a7f68] max-w-[280px]">
                    <span className="block h-full" style={{ width: `${Math.max(0, Math.min(1, a.freshness_score)) * 100}%`, background: freshColor(a.freshness_score) }} />
                  </div>
                </div>
                <div
                  className="shrink-0 text-[10px] font-bold px-2 py-0.5 border border-black text-white tabular-nums"
                  title={`Evidence freshness: ${(a.freshness_score * 100).toFixed(0)}% across ${a.claim_count} claims`}
                  style={{ background: freshColor(a.freshness_score) }}
                >
                  {(a.freshness_score * 100).toFixed(0)}%
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
