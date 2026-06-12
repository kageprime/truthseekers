export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097";

import type {
  Article as ArticleType,
  MediaItem,
  ArticleMetadata,
  Section,
  TimelineEvent as TimelineEventType,
  CrossReference,
  Citation,
  ThreeDScene,
  ThreeDMapScene,
  ThreeDBuilding,
  ThreeDAnnotation,
  JobInfo as JobInfoType,
} from "@encarta/core";

export type {
  ArticleType as Article,
  MediaItem,
  ArticleMetadata,
  Section,
  TimelineEventType as TimelineEvent,
  CrossReference,
  Citation,
  ThreeDScene,
  ThreeDMapScene,
  ThreeDBuilding,
  ThreeDAnnotation,
  JobInfoType as JobInfo,
};

interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
  thumbnail?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export async function fetchArticles(offset = 0, limit = 50): Promise<PaginatedResponse<ArticleSummary>> {
  const res = await fetch(`${BASE}/articles?limit=${limit}&offset=${offset}`, {
    cache: "no-store",
  });
  if (!res.ok) return { data: [], pagination: { limit, offset, hasMore: false, nextOffset: null } };
  return res.json();
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  const res = await fetch(`${BASE}/articles/search?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchArticle(slug: string): Promise<ArticleType | null> {
  const res = await fetch(`${BASE}/articles/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleStatus(slug: string): Promise<JobInfoType | { status: string } | null> {
  const res = await fetch(`${BASE}/articles/${slug}/status`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateArticle(slug: string, persona?: string): Promise<{ status: string; persona?: string }> {
  const res = await fetch(`${BASE}/articles/${slug}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona: persona || "veritas" }),
  });
  return res.json();
}

export async function refreshArticle(slug: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/articles/${slug}/refresh`, { method: "POST" });
  return res.json();
}

export function progressUrl(slug: string): string {
  return `${BASE}/articles/${slug}/progress`;
}

// --- Maps ---

export interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  type?: "city" | "battle" | "site" | "museum" | "other";
}

export interface MapLayer {
  id: string;
  label: string;
  year?: number;
  geoJson: object;
  visible?: boolean;
}

export interface MapEntry {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  content: string;
  image?: string;
  region?: string;
  era?: string;
  type: "static" | "interactive";
  externalUrl?: string;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  geoJson?: object;
  markers?: MapMarker[];
  layers?: MapLayer[];
  timeline?: TimelineEventType[];
  threedScene?: ThreeDMapScene;
  createdAt: string;
  updatedAt: string;
}

interface MapsResponse {
  data: MapEntry[];
  interactive: MapEntry[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
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
