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
      className="pixel-card-sm p-0 overflow-hidden block"
      style={{ background: "white", textDecoration: "none", color: "inherit" }}
    >
      <div className="w-full h-32 overflow-hidden" style={{ background: "var(--skeleton)" }}>
        {article.thumbnail ? (
          <img
            src={article.thumbnail}
            alt=""
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
            style={{ background: "linear-gradient(135deg, #fef3c7, #e0f2fe)", color: "var(--subtle)" }}>
            {article.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="pixel text-[10px] mb-1" style={{ color: "#1a1a1a" }}>
          {article.title}
        </h3>
        <p className="text-xs line-clamp-2 leading-relaxed mt-1" style={{ color: "var(--muted)" }}>{article.abstract}</p>
        <div className="flex items-center gap-2 mt-2">
          {article.categories?.slice(0, 2).map((cat) => (
            <span key={cat} className="pixel-tag text-[10px]">{cat}</span>
          ))}
          <span className="text-xs ml-auto" style={{ color: "var(--subtle)" }}>v{article.metadata.version}</span>
        </div>
      </div>
      </Link>
  );
}
