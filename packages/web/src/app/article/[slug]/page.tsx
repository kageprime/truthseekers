import ArticleClient from "./ArticleClient";
import type { Article } from "@encarta/core";
import { BASE } from "@/lib/constants";

async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${BASE}/articles/${slug}`, {
      cache: "no-store",
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchArticleStatus(slug: string): Promise<{ status: string; phase?: string } | null> {
  try {
    const res = await fetch(`${BASE}/articles/${slug}/status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await fetchArticle(slug);

  if (!article) {
    const status = await fetchArticleStatus(slug);
    const isGenerating = status && status.status !== "not_found" && status.status !== "done" && status.status !== "published";

    return (
      <ArticleClient
        slug={slug}
        article={null}
        isGenerating={!!isGenerating}
        initialPhase={status?.phase || status?.status || ""}
      />
    );
  }

  return <ArticleClient slug={slug} article={article} isGenerating={false} initialPhase="" />;
}
