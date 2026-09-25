import { API_BASE } from "./config";
import { getStoredToken, storeToken } from "./token";
import type { Article, ArticleSummary, AuthUser, Claim, ClaimGraphEdge, ClaimGraphNode, Evidence, Gap, MapEntry } from "./types";

// ponytail: public reads send no credentials — with cookies attached the
// browser rejects any ACAO:* response, which silently killed all live data.
// Bearer + cookies stay on authed() mutations only.
async function get<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // offline backend → caller renders static fallback
  }
}

export function authHeaders(): Record<string, string> {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// A 401 from a user-initiated mutation means the session died mid-task:
// route to login preserving the current path. Background reads never call this.
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  if (next.startsWith("/login")) return;
  window.location.assign(`/login?redirect=${encodeURIComponent(next)}`);
}

// Mutations attach Bearer + cookies; 401 means login needed (caller redirects, reads never do).
export async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers || {}),
    },
    credentials: "include",
  });
  if (res.status === 401) redirectToLogin();
  return res;
}

export async function fetchArticles(limit = 50, offset = 0, signal?: AbortSignal) {
  const json = await get<{
    data: ArticleSummary[];
    pagination: { hasMore: boolean; nextOffset: number | null };
  }>(`/articles?limit=${limit}&offset=${offset}`, signal);
  return json ?? { data: [], pagination: { hasMore: false, nextOffset: null } };
}

export async function fetchHealth(signal?: AbortSignal) {
  return get<{ article_count?: number; storage_mode?: string }>(`/health`, signal);
}

export async function fetchFeaturedArticles(signal?: AbortSignal) {
  const json = await get<ArticleSummary[]>(`/featured`, signal);
  return json ?? [];
}

export async function searchArticles(q: string, signal?: AbortSignal) {
  if (!q.trim()) return [] as ArticleSummary[];
  return (await get<ArticleSummary[]>(`/articles/search?q=${encodeURIComponent(q)}`, signal)) ?? [];
}

export async function fetchArticle(slug: string, signal?: AbortSignal) {
  return get<Article>(`/articles/${encodeURIComponent(slug)}`, signal);
}

export async function searchClaims(q: string, limit = 20, signal?: AbortSignal) {
  if (q.trim().length < 2) return [] as Claim[];
  const json = await get<{ claims: Claim[] }>(
    `/claims/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    signal
  );
  return json?.claims ?? [];
}

export async function fetchContestedClaims(limit = 20, signal?: AbortSignal) {
  const json = await get<{ claims: Claim[] }>(`/contested?limit=${limit}`, signal);
  return json?.claims ?? [];
}

export async function fetchMaps(limit = 50, offset = 0, signal?: AbortSignal) {
  const json = await get<{ data: MapEntry[] }>(`/maps?limit=${limit}&offset=${offset}`, signal);
  return json?.data ?? [];
}

export async function trackView(slug: string) {
  try {
    await fetch(`${API_BASE}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ slug, event: "view" }),
    });
  } catch {
    /* fire-and-forget */
  }
}

// Chat is auth-required: returns null when anon so UI shows login CTA instead of fake replies.
export async function createChat(title?: string) {
  const res = await authed(`/chat`, { method: "POST", body: JSON.stringify({ title }) });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; title: string };
}

export function chatMessagesUrl(id: string) {
  return `${API_BASE}/chat/${encodeURIComponent(id)}/messages`;
}

// ── Auth ─────────────────────────────────────────────────────────

export interface LoginResponse {
  user?: AuthUser;
  token?: string;
  sent?: boolean;
  error?: string;
}

async function postAuth(path: string, body: unknown): Promise<LoginResponse> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Request failed" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

// Step 1 of OTP login AND signup activation: emails the 6-digit code.
export function loginEmail(email: string) {
  return postAuth(`/auth/login`, { email });
}

export function verifyOTP(email: string, code: string) {
  return postAuth(`/auth/otp/verify`, { email, code });
}

export function loginPassword(email: string, password: string) {
  return postAuth(`/auth/password/login`, { email, password });
}

export function registerPassword(email: string, code: string, password: string) {
  return postAuth(`/auth/password/register`, { email, code, password });
}

export function signup(username: string, email: string, password: string) {
  return postAuth(`/auth/signup`, { username, email, password });
}

export function activateSignup(email: string, code: string) {
  return postAuth(`/auth/signup/activate`, { email, code });
}

// Session check: null = genuine rejection (caller may clear), throw = blip.
export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { ...authHeaders() },
    cache: "no-store",
    credentials: "include",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session check failed: ${res.status}`);
  const data = await res.json();
  if (typeof data?.token === "string" && data.token) storeToken(data.token);
  return data.user ?? null;
}

export async function fetchMeCookie(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { cache: "no-store", credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session check failed: ${res.status}`);
  const data = await res.json();
  if (typeof data?.token === "string" && data.token) storeToken(data.token);
  return data.user ?? null;
}

export async function logoutServer(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    /* best-effort */
  }
}

export async function onboard(): Promise<boolean> {
  try {
    const res = await authed(`/auth/onboard`, { method: "POST", body: JSON.stringify({}) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Article writes (all authed) ──────────────────────────────────

export async function generateArticle(slug: string, persona = "veritas") {
  const res = await authed(`/articles/${encodeURIComponent(slug)}/generate`, {
    method: "POST",
    body: JSON.stringify({ persona }),
  });
  return res.json().catch(() => ({ status: "error" }));
}

export async function refreshArticle(slug: string) {
  const res = await authed(`/articles/${encodeURIComponent(slug)}/refresh`, { method: "POST" });
  return res.json().catch(() => ({ status: "error" }));
}

export type ContestResult =
  | { status: "queued" | "no_change" | "busy" | "undecided"; reasoning?: string; error?: string };

export async function contestArticle(slug: string, argument: string): Promise<ContestResult> {
  try {
    const res = await authed(`/articles/${encodeURIComponent(slug)}/contest`, {
      method: "POST",
      body: JSON.stringify({ argument }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { status: "undecided", error: "Please log in to contest." };
    if (res.status === 429) return { status: "busy", error: data.error || "Generation already running" };
    if (!res.ok) return { status: "undecided", error: data.error || "Contest failed" };
    return data;
  } catch {
    return { status: "undecided", error: "Network error" };
  }
}

export async function fetchArticleClaims(slug: string, signal?: AbortSignal) {
  const json = await get<{ claims: Claim[] }>(`/articles/${encodeURIComponent(slug)}/claims`, signal);
  return json?.claims ?? [];
}

export async function fetchArticleClaimGraph(slug: string, signal?: AbortSignal) {
  const json = await get<{ nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[] }>(
    `/articles/${encodeURIComponent(slug)}/claim-graph`,
    signal
  );
  return json ?? { nodes: [], edges: [] };
}

export async function fetchClaimEvidence(claimId: string, signal?: AbortSignal) {
  const json = await get<{ claim: Claim | null; evidence: Evidence[] }>(
    `/claims/${encodeURIComponent(claimId)}/evidence`,
    signal
  );
  return json ?? { claim: null, evidence: [] };
}

export async function fetchAllGaps(signal?: AbortSignal) {
  const json = await get<{ gaps: Gap[] }>(`/gaps`, signal);
  return json?.gaps ?? [];
}

export async function submitClaimEvidence(claimId: string, url: string, note: string) {
  const res = await authed(`/claims/${encodeURIComponent(claimId)}/evidence`, {
    method: "POST",
    body: JSON.stringify({ url, note, supports_claim: false, type: "primary_document" }),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function upvoteGap(gapId: string) {
  const res = await authed(`/gaps/${encodeURIComponent(gapId)}/upvote`, { method: "POST" });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function submitGapEvidence(gapId: string, url: string, note: string) {
  const res = await authed(`/gaps/${encodeURIComponent(gapId)}/submit`, {
    method: "POST",
    body: JSON.stringify({ url, note }),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export function progressUrl(slug: string) {
  return `${API_BASE}/articles/${encodeURIComponent(slug)}/progress`;
}

// ponytail: plain link, not a fetch — the endpoint answers with a download.
export function exportArticleUrl(slug: string, format: "json" | "markdown" = "markdown") {
  return `${API_BASE}/articles/${encodeURIComponent(slug)}/export?format=${format}`;
}
