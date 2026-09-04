import type { MetadataRoute } from "next";
import { BASE } from "@/lib/constants";

interface ArticleSummary {
  slug: string;
  metadata?: { updated?: string; created?: string };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let articles: ArticleSummary[] = [];
  try {
    const res = await fetch(`${BASE}/articles?limit=5000`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = await res.json();
      articles = json.data ?? [];
    }
  } catch {
    articles = [];
  }

  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/articles`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/contested`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/gaps`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/stale`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/claim-graph`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
  ];

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE}/article/${a.slug}`,
    lastModified: a.metadata?.updated ? new Date(a.metadata.updated) : a.metadata?.created ? new Date(a.metadata.created) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...articlePages];
}
