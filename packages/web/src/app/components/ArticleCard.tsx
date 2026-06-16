"use client";

import Link from "next/link";

interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
  thumbnail?: string;
}

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="glass-card overflow-hidden block group"
      style={{ textDecoration: "none", color: "inherit" }}
     
    >
      <div className="w-full aspect-[16/9] overflow-hidden" style={{ background: "var(--skeleton-start)" }}>
        {article.thumbnail ? (
          <img
            src={article.thumbnail}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
            style={{ background: "linear-gradient(135deg, var(--accent-bg), var(--border-light))", color: "var(--subtle)" }}>
            {article.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-sm leading-snug" style={{ color: "var(--ink)" }}>
          {article.title}
        </h3>
        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--muted)" }}>{article.abstract}</p>
        <div className="flex items-center gap-2 pt-1">
          {article.categories?.slice(0, 2).map((cat) => (
            <span key={cat} className="tag tag-subtle text-[10px]">{cat}</span>
          ))}
          {article.metadata?.version && (
            <span className="text-xs ml-auto" style={{ color: "var(--subtle)" }}>v{article.metadata.version}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
