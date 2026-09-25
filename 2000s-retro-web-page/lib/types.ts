// Minimal domain types mirroring Go storage (veritas/go-orchestrator/internal/storage/db.go)
// and packages/core/src/types.ts. Keep in sync when backend adds fields.

export interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
  thumbnail?: string;
}

export interface MediaItem {
  type: string;
  id?: string;
  caption?: string;
  src?: string;
  source?: string;
  prompt?: string;
}

export interface Article extends ArticleSummary {
  sections: { id: string; title: string; content: string; media?: MediaItem[] }[];
  timeline: { year: number | string; event: string; description?: string }[];
  crossrefs: { id: string; title: string; relationship: string }[];
  citations: { url: string; title: string }[];
  derived_confidence?: number;
}

export interface Claim {
  id: string;
  text: string;
  status: "supported" | "disputed" | "weak" | "unknown" | string;
  derived_confidence?: number;
  article_slug?: string;
  article_title?: string;
}

export interface Evidence {
  id: string;
  url: string;
  supports_claim: boolean;
  chain_of_custody?: string;
  accessibility?: string;
}

export interface Gap {
  id: string;
  claim_id: string;
  expected_artifact: string;
  cause_label?: string;
  article_slug?: string;
  claim_text?: string;
  upvotes?: number;
}

export interface ClaimGraphNode {
  id: string;
  type: "claim" | "evidence" | string;
  label: string;
  short_label?: string;
  status?: string;
  confidence?: number;
  contradiction_level?: number;
  supports?: boolean;
  chain_of_custody?: string;
}

export interface ClaimGraphEdge {
  source: string;
  target: string;
  type: "evidence" | "claim" | string;
  relationship: string;
  strength?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  subscriptionTier: string;
  onboarded: boolean;
  role?: string;
}

export interface MapEntry {
  slug: string;
  title: string;
  description: string;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  markers?: { lat: number; lng: number; title: string; description?: string }[];
}
