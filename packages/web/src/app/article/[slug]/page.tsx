import ArticleClient from "./ArticleClient";
import ClaimReviewJsonLd from "../../components/ClaimReviewJsonLd";
import type { Article } from "@encarta/core";
import { BASE } from "@/lib/constants";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${BASE}/articles/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchArticleClaims(slug: string): Promise<Array<{ id: string; text: string; status?: string; derived_confidence?: number }>> {
  try {
    const res = await fetch(`${BASE}/articles/${slug}/claims`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.claims ?? [];
  } catch {
    return [];
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) {
    return { title: `${slug.replace(/-/g, " ")} · Truthseekers` };
  }
  const title = article.title || slug.replace(/-/g, " ");
  const description = article.abstract?.slice(0, 200) || `An evidence-grounded encyclopedia article about ${title}.`;
  return {
    title: `${title} · Truthseekers`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/article/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, claims] = await Promise.all([
    fetchArticle(slug),
    fetchArticleClaims(slug),
  ]);

  if (!article) {
    const status = await fetchArticleStatus(slug);
    const isGenerating = status && status.status !== "not_found" && status.status !== "done" && status.status !== "published";

    return (
      <>
        <ArticleClient
          slug={slug}
          article={null}
          isGenerating={!!isGenerating}
          initialPhase={status?.phase || status?.status || ""}
        />
      </>
    );
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(["article", slug], article);
  queryClient.setQueryData(["article", slug, "claims"], { claims });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClaimReviewJsonLd slug={slug} article={article} claims={claims} />
      <ArticleClient slug={slug} article={article} isGenerating={false} initialPhase="" />
    </HydrationBoundary>
  );
}
