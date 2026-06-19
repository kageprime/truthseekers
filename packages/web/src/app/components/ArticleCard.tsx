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
        className="relative overflow-hidden rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
      >
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: "var(--accent)" }} />

        {/* Thumbnail area */}
        {article.thumbnail ? (
          <div className="relative h-36 overflow-hidden">
            <img
              src={article.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--surface-elevated) 0%, transparent 50%)" }} />
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
            <span className="text-3xl font-bold font-display" style={{ color: "var(--accent)" }}>
              {article.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Tags — absolute over image */}
        {article.categories && article.categories.length > 0 && (
          <div className="absolute top-3 left-3 flex gap-1.5 z-10">
            {article.categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="text-[9px] px-2 py-0.5 rounded-full font-medium tracking-wide uppercase backdrop-blur-sm"
                style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Version badge — absolute top-right */}
        {article.metadata?.version && (
          <span
            className="absolute top-3 right-3 text-[9px] px-1.5 py-0.5 rounded font-mono backdrop-blur-sm z-10"
            style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
          >
            v{article.metadata.version}
          </span>
        )}

        {/* Content */}
        <div className="relative z-10 px-4 pb-4 pt-3">
          <h3 className="font-display font-semibold text-sm leading-snug mb-1 line-clamp-2" style={{ color: "var(--ink)" }}>
            {article.title}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2 font-serif" style={{ color: "var(--muted)" }}>
            {article.abstract || "No description available."}
          </p>
        </div>
      </article>
    </Link>
  );
}
