"use client";

import Link from "next/link";
import type { ArticleSummary } from "@encarta/core";
import { labelForCategory } from "./editorial/CategoryIcon";

/**
 * ArticleCard — archival plate card.
 * Sharp 2px radius, hairline rule, gold top edge that widens on hover.
 * Thumbnail is a figure plate; categories are small-caps serif chips.
 */
export default function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="block group"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <article
        className="relative overflow-hidden article-plate"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--rule)", borderRadius: "var(--radius-sharp)" }}
      >
        {/* Gold top edge — widens on hover */}
        <span
          className="absolute top-0 left-0 h-[2px] z-10"
          style={{ background: "var(--gold)", width: "32%", transition: "width 0.35s cubic-bezier(0.23,1,0.32,1)" }}
        />
        <span className="absolute top-0 right-0 h-[2px] z-10" style={{ background: "var(--rule)", width: "68%" }} />

        {/* Thumbnail / initial plate */}
        {article.thumbnail ? (
          <div className="relative h-36 overflow-hidden">
            <img
              src={article.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transition: "transform 0.6s cubic-bezier(0.23,1,0.32,1)" }}
              loading="lazy"
            />
            <div
              style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--surface-elevated) 0%, transparent 45%)" }}
            />
          </div>
        ) : (
          <div
            className="h-28 flex items-center justify-center"
            style={{ background: "var(--gold-bg)" }}
          >
            <span className="font-display text-4xl" style={{ color: "var(--gold)" }}>
              {article.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Categories — small-caps serif chips over the image */}
        {article.categories && article.categories.length > 0 && (
          <div className="absolute top-3 left-3 flex gap-1.5 z-10">
            {article.categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="font-serif text-[9px] px-2 py-0.5 small-caps"
                style={{ background: "rgba(26,22,18,0.60)", color: "#f0e3c4", backdropFilter: "blur(4px)", letterSpacing: "0.06em" }}
              >
                {labelForCategory(cat)}
              </span>
            ))}
          </div>
        )}

        {/* Version mark */}
        {article.metadata?.version && (
          <span
            className="absolute top-3 right-3 font-mono text-[9px] px-1.5 py-0.5 z-10"
            style={{ background: "rgba(26,22,18,0.55)", color: "#e8dcc0", backdropFilter: "blur(4px)" }}
          >
            v{article.metadata.version}
          </span>
        )}

        {/* Content */}
        <div className="relative z-10 px-4 pb-4 pt-3">
          <h3
            className="font-display font-semibold text-[0.95rem] leading-snug mb-1 line-clamp-2"
            style={{ color: "var(--ink)", letterSpacing: "-0.005em" }}
          >
            {article.title}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2 font-serif italic" style={{ color: "var(--muted)" }}>
            {article.abstract || "No description available."}
          </p>
        </div>
      </article>
    </Link>
  );
}
