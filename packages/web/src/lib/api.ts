import { BASE } from "./constants";
import type { Article, JobInfo, ArticleSummary, QuotaInfo, ConversationSummary, ConversationDetail, MapEntry } from "@encarta/core";

interface PaginatedResponse<T> {
  data: T[];
  pagination: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
}

export async function fetchArticles(offset = 0, limit = 50): Promise<PaginatedResponse<ArticleSummary>> {
  const res = await fetch(`${BASE}/articles?limit=${limit}&offset=${offset}`, { cache: "no-store" });
  if (!res.ok) return { data: [], pagination: { limit, offset, hasMore: false, nextOffset: null } };
  return res.json();
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  const res = await fetch(`${BASE}/articles/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchArticle(slug: string): Promise<Article | null> {
  const res = await fetch(`${BASE}/articles/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleStatus(slug: string): Promise<JobInfo | { status: string } | null> {
  const res = await fetch(`${BASE}/articles/${slug}/status`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchQuota(): Promise<QuotaInfo | null> {
  const res = await fetch(`${BASE}/quota`, { cache: "no-store", headers: { ...authHeaders() } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateArticle(slug: string, persona?: string): Promise<{ status: string; persona?: string; quota?: QuotaInfo }> {
  const res = await fetch(`${BASE}/articles/${slug}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ persona: persona || "veritas" }),
  });
  return res.json();
}

export async function refreshArticle(slug: string): Promise<{ status: string; quota?: QuotaInfo }> {
  const res = await fetch(`${BASE}/articles/${slug}/refresh`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return res.json();
}

export function progressUrl(slug: string): string {
  return `${BASE}/articles/${slug}/progress`;
}

// --- Maps ---

interface MapsResponse {
  data: MapEntry[];
  interactive: MapEntry[];
  pagination: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
}

export async function fetchMaps(limit = 50, offset = 0): Promise<{ maps: MapEntry[]; interactive: MapEntry[] }> {
  const res = await fetch(`${BASE}/maps?limit=${limit}&offset=${offset}`, { cache: "no-store" });
  if (!res.ok) return { maps: [], interactive: [] };
  const json: MapsResponse = await res.json();
  return { maps: json.data, interactive: json.interactive };
}

export async function searchMaps(query: string): Promise<MapEntry[]> {
  const res = await fetch(`${BASE}/maps/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMap(slug: string): Promise<MapEntry | null> {
  const res = await fetch(`${BASE}/maps/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

// ── Chat ──

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("truthseekers_token");
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function createChat(title?: string): Promise<ConversationSummary | null> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) { console.error("createChat failed", res.status, await res.text().catch(() => "")); return null; }
  return res.json();
}

export async function fetchChats(): Promise<ConversationSummary[]> {
  const res = await fetch(`${BASE}/chat`, { cache: "no-store", headers: { ...authHeaders() } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchChat(id: string): Promise<ConversationDetail | null> {
  const res = await fetch(`${BASE}/chat/${id}`, { cache: "no-store", headers: { ...authHeaders() } });
  if (!res.ok) return null;
  return res.json();
}

export async function updateChatTitle(id: string, title: string): Promise<boolean> {
  const res = await fetch(`${BASE}/chat/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title }),
  });
  return res.ok;
}

export function chatProgressUrl(id: string): string {
  return `${BASE}/chat/${id}/messages`;
}

// ── Admin ────────────────────────────────────────────────

export async function fetchSettings(): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/admin/settings`, { cache: "no-store", headers: { ...authHeaders() } });
  if (!res.ok) return {};
  return res.json();
}

export async function updateSettings(settings: Record<string, string>): Promise<boolean> {
  const res = await fetch(`${BASE}/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ settings }),
  });
  return res.ok;
}

export async function fetchFeaturedArticles(): Promise<ArticleSummary[]> {
  const settings = await fetchSettings();
  const raw = settings.featured_articles;
  if (!raw) return [];
  let slugs: string[];
  try { slugs = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(slugs) || slugs.length === 0) return [];
  const results = await Promise.allSettled(slugs.map((s) => fetchArticle(s)));
  const articles: ArticleSummary[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      const a = r.value;
      articles.push({
        slug: a.slug,
        title: a.title,
        abstract: a.abstract,
        metadata: a.metadata,
        categories: a.categories,
      });
    }
  }
  return articles;
}
