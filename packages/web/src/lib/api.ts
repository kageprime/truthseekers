const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097";

interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
}

interface Article extends ArticleSummary {
  sections: Section[];
  timeline: TimelineEvent[];
  crossrefs: CrossReference[];
  citations: Citation[];
  threedScenes: ThreeDScene[];
  metadata: ArticleMetadata;
}

interface Section {
  id: string;
  title: string;
  content: string;
  media: MediaItem[];
}

interface MediaItem {
  type: "image" | "diagram" | "timeline" | "threed";
  id: string;
  caption: string;
  src?: string;
  code?: string;
  prompt?: string;
}

interface TimelineEvent {
  year: number;
  event: string;
  description: string;
}

interface CrossReference {
  id: string;
  title: string;
  relationship: string;
}

interface Citation {
  url: string;
  title: string;
  accessed?: string;
  relevance?: string;
}

interface ArticleMetadata {
  version: number;
  created: string;
  updated: string;
  status: string;
}

interface ThreeDScene {
  id: string;
  code: string;
  description: string;
}

interface JobInfo {
  slug: string;
  status: string;
  phase: string;
  createdAt: string;
  error?: string;
}

export async function fetchArticles(limit = 50, offset = 0): Promise<ArticleSummary[]> {
  const res = await fetch(`${API_URL}/articles?limit=${limit}&offset=${offset}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  const res = await fetch(`${API_URL}/articles/search?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchArticle(slug: string): Promise<Article | null> {
  const res = await fetch(`${API_URL}/articles/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleStatus(slug: string): Promise<JobInfo | { status: string } | null> {
  const res = await fetch(`${API_URL}/articles/${slug}/status`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateArticle(slug: string, persona?: string): Promise<{ status: string; persona?: string }> {
  const res = await fetch(`${API_URL}/articles/${slug}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona: persona || "veritas" }),
  });
  return res.json();
}

export async function refreshArticle(slug: string): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/articles/${slug}/refresh`, { method: "POST" });
  return res.json();
}

export function progressUrl(slug: string): string {
  return `${API_URL}/articles/${slug}/progress`;
}
