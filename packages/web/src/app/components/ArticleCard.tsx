"use client";

import Link from "next/link";
import type { ArticleSummary } from "@encarta/core";

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="block group"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <article
        className="overflow-hidden transition-all duration-200"
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface-elevated)",
        }}
      >
        {article.thumbnail && (
          <div className="w-full overflow-hidden" style={{ borderBottom: "1px solid var(--border)", maxHeight: 160 }}>
            <img
              src={article.thumbnail}
              alt=""
              className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
              loading="lazy"
            />
          </div>
        )}
        <div className="p-4 space-y-1.5">
          <h3 className="font-display font-bold text-sm leading-snug" style={{ color: "var(--ink)" }}>
            {article.title}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2 font-serif" style={{ color: "var(--muted)" }}>{article.abstract}</p>
          <div className="flex items-center gap-2 pt-1.5">
            {article.categories?.slice(0, 2).map((cat) => (
              <span key={cat} className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--accent)" }}>{cat}</span>
            ))}
            {article.metadata?.version && (
              <span className="text-[10px] ml-auto font-mono" style={{ color: "var(--subtle)" }}>v{article.metadata.version}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
