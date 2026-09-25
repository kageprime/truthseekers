import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";
import type { Article, Claim, Gap } from "@/lib/types";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ArticleShell, MissingArticle } from "./ArticleShell";

async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_BASE}/articles/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ponytail: the composite /epistemic endpoint hangs (30s+ timeouts observed),
// so the shell assembles the same bundle from the fast single-purpose
// endpoints — each with its own 8s ceiling, all failures caught.
async function timed(path: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchEpistemic(slug: string) {
  const enc = encodeURIComponent(slug);
  // ponytail: /freshness hangs like /epistemic (backend follow-up filed) —
  // the shell hides the score when null, so skip it rather than stalling SSR.
  const [claims, gaps] = await Promise.all([
    timed(`/articles/${enc}/claims`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    timed(`/articles/${enc}/gaps`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  return {
    claims: ((claims?.claims ?? []) as Claim[]),
    gaps: ((gaps?.gaps ?? []) as Gap[]),
    freshness: null as { overall_score: number } | null,
  };
}

async function fetchStatus(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/articles/${encodeURIComponent(slug)}/status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ status: string; phase?: string }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  const title = article?.title || slug.replace(/-/g, " ");
  const description =
    article?.abstract?.slice(0, 200) || `An evidence-grounded encyclopedia article about ${title}.`;
  return {
    title: `${title} · Everything Encyclopedia`,
    description,
    openGraph: { title, description, type: "article", url: `/articles/${slug}` },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, epistemic] = await Promise.all([fetchArticle(slug), fetchEpistemic(slug)]);

  if (!article) {
    const status = await fetchStatus(slug);
    const generating =
      !!status && !["not_found", "done", "error", "published"].includes(status.status);
    return (
      <main className="min-h-screen bg-paper text-ink">
        <SiteHeader kicker="The reading room" />
        <MissingArticle slug={slug} generating={generating} phase={status?.phase || status?.status || ""} />
        <SiteFooter />
      </main>
    );
  }

  return <ArticleShell slug={slug} article={article} epistemic={epistemic} isGenerating={false} initialPhase="" />;
}
