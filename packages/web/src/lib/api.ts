import { BASE } from "./constants";
import { getStoredToken, storeToken } from "./token";
import type { Article, JobInfo, ArticleSummary, QuotaInfo, ConversationSummary, ConversationDetail, MapEntry } from "@encarta/core";
import * as mock from "./mock-data";

const MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

if (MOCK) console.log("🧪 Mock mode enabled — no live API calls");

interface PaginatedResponse<T> {
  data: T[];
  pagination: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
}

export async function fetchArticles(offset = 0, limit = 50): Promise<PaginatedResponse<ArticleSummary>> {
  if (MOCK) return { data: mock.MOCK_ARTICLE_SUMMARIES.slice(offset, offset + limit), pagination: { limit, offset, hasMore: offset + limit < mock.MOCK_ARTICLE_SUMMARIES.length, nextOffset: offset + limit < mock.MOCK_ARTICLE_SUMMARIES.length ? offset + limit : null } };
  const res = await fetch(`${BASE}/articles?limit=${limit}&offset=${offset}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return { data: [], pagination: { limit, offset, hasMore: false, nextOffset: null } };
  return res.json();
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  if (MOCK) return mock.MOCK_ARTICLE_SUMMARIES.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()) || a.abstract.toLowerCase().includes(query.toLowerCase()));
  const res = await fetch(`${BASE}/articles/search?q=${encodeURIComponent(query)}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchArticle(slug: string): Promise<Article | null> {
  if (MOCK) return mock.MOCK_ARTICLES[slug] || null;
  const res = await fetch(`${BASE}/articles/${slug}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleStatus(slug: string): Promise<JobInfo | { status: string } | null> {
  if (MOCK) return mock.MOCK_QUEUE_JOBS.find((j) => j.slug === slug) || { status: "not_found" };
  const res = await fetch(`${BASE}/articles/${slug}/status`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchQuota(): Promise<QuotaInfo | null> {
  if (MOCK) return mock.MOCK_QUOTA;
  const res = await fetch(`${BASE}/quota`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateArticle(slug: string, persona?: string): Promise<{ status: string; persona?: string; quota?: QuotaInfo }> {
  if (MOCK) return { status: "queued", persona: persona || "veritas" };
  const res = await authed(`/articles/${slug}/generate`, {
    method: "POST",
    body: JSON.stringify({ persona: persona || "veritas" }),
  });
  if (!res.ok) return { status: "error" };
  return res.json();
}

export async function refreshArticle(slug: string): Promise<{ status: string; quota?: QuotaInfo }> {
  if (MOCK) return { status: "queued" };
  const res = await authed(`/articles/${slug}/refresh`, { method: "POST" });
  if (!res.ok) return { status: "error" };
  return res.json();
}

export function progressUrl(slug: string): string {
  return MOCK ? "" : `${BASE}/articles/${slug}/progress`;
}

// --- Maps ---

interface MapsResponse {
  data: MapEntry[];
  interactive: MapEntry[];
  pagination: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
}

export async function fetchMaps(limit = 50, offset = 0): Promise<{ maps: MapEntry[]; interactive: MapEntry[] }> {
  if (MOCK) {
    const all = mock.MOCK_MAPS;
    return { maps: all.filter((m) => m.type === "static"), interactive: all.filter((m) => m.type === "interactive") };
  }
  const res = await fetch(`${BASE}/maps?limit=${limit}&offset=${offset}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return { maps: [], interactive: [] };
  const json: MapsResponse = await res.json();
  return { maps: json.data, interactive: json.interactive };
}

export async function searchMaps(query: string): Promise<MapEntry[]> {
  if (MOCK) return mock.MOCK_MAPS.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));
  const res = await fetch(`${BASE}/maps/search?q=${encodeURIComponent(query)}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMap(slug: string): Promise<MapEntry | null> {
  if (MOCK) return mock.MOCK_MAPS.find((m) => m.slug === slug) || null;
  const res = await fetch(`${BASE}/maps/${slug}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

// ── Chat ──

// Canonical auth header builder — memory token first, legacy readable
// cookie/localStorage fallback via getStoredToken. Every authenticated fetch
// uses this so the OTP-login JWT (memory-only, S7) is actually attached;
// without it, freshly-logged-in users sent no credentials cross-origin.
export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

// B3: a 401 from a user-initiated mutation means the session died mid-task.
// Route to login with the current path preserved instead of surfacing a
// misleading operation error. Background reads/pings never call this.
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  if (next.startsWith("/login")) return;
  window.location.assign(`/login?redirect=${encodeURIComponent(next)}`);
}

// authed() is the single wrapper for user-initiated mutations: attaches the
// session, sends cookies, and routes genuine 401s to login. Callers keep
// their own fallback returns for the (now-redirecting) failure path.
async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers || {}) },
    credentials: "include",
  });
  if (res.status === 401) redirectToLogin();
  return res;
}

// B1: cookie-block probe — same session check as fetchMeCookie but WITHOUT
// the Bearer header, so the verdict is strictly about the HttpOnly cookie.
// A transport blip returns true (unknown ≠ blocked); only a clean 401 warns.
export async function probeCookieSession(): Promise<boolean> {
  if (MOCK) return true;
  try {
    const res = await fetch(`${BASE}/auth/me`, { cache: "no-store", credentials: "include" });
    return res.ok;
  } catch {
    return true;
  }
}

export async function createChat(title?: string): Promise<ConversationSummary | null> {
  if (MOCK) return { id: `conv-mock-${Date.now()}`, title: title || "New Chat", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 };
  const res = await authed(`/chat`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) { console.error("createChat failed", res.status, await res.text().catch(() => "")); return null; }
  return res.json();
}

export async function fetchChats(): Promise<ConversationSummary[]> {
  if (MOCK) return mock.MOCK_CONVERSATIONS;
  const res = await fetch(`${BASE}/chat`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) { console.warn("fetchChats failed", res.status, res.statusText); return []; }
  return res.json();
}

export async function fetchChat(id: string): Promise<ConversationDetail | null> {
  if (MOCK) return mock.MOCK_CONVERSATION_DETAILS[id] || null;
  const res = await fetch(`${BASE}/chat/${id}`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function updateChatTitle(id: string, title: string): Promise<boolean> {
  if (MOCK) return true;
  const res = await authed(`/chat/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  return res.ok;
}

export function chatProgressUrl(id: string): string {
  return `${BASE}/chat/${id}/messages`;
}

export function chatStopUrl(id: string): string {
  return `${BASE}/chat/${id}/stop`;
}

// ── Auth ───────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  subscriptionTier: string;
  onboarded: boolean;
  role?: string;
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  if (MOCK) return null; // AuthProvider handles mock with MOCK_USER
  // Contract: null means genuine rejection (401 / user gone) — the caller
  // may clear credentials. Anything else throws so transient failures
  // (network, 5xx, restart) never masquerade as logout.
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    credentials: "include",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session check failed: ${res.status}`);
  const data = await res.json();
  // Sliding renewal: the server rotates the token inside the expiry window.
  // Persist it so memory and cookie stay in step (the provider's poller
  // picks up the new value without a reload).
  if (typeof data?.token === "string" && data.token) storeToken(data.token);
  return data.user ?? null;
}

// fetchMeCookie restores the session from the HttpOnly cookie (S7) — for
// cookie-only users with no JS-readable token (e.g. after reload). Same
// contract as fetchMe: null is rejection, anything else throws.
export async function fetchMeCookie(): Promise<AuthUser | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/auth/me`, { cache: "no-store", credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session check failed: ${res.status}`);
  const data = await res.json();
  if (typeof data?.token === "string" && data.token) storeToken(data.token);
  return data.user ?? null;
}

// logoutServer expires the HttpOnly session cookie (S7). Fire-and-forget.
export async function logoutServer(): Promise<void> {
  if (MOCK) return;
  try {
    await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" });
  } catch { /* best-effort */ }
}

export interface LoginResponse {
  user?: AuthUser;
  token?: string;
  sent?: boolean;
  error?: string;
}

export async function loginEmail(email: string): Promise<LoginResponse> {
  if (MOCK) return { token: "truthseekers_mock", user: { id: "user-mock-1", email, name: "Dr. Alex Researcher", avatar: "", subscriptionTier: "pro", onboarded: true } };
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Login failed" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function verifyOTP(email: string, code: string): Promise<LoginResponse> {
  if (MOCK) return loginEmail(email);
  try {
    const res = await fetch(`${BASE}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Invalid or expired code" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function registerPassword(email: string, code: string, password: string): Promise<LoginResponse> {
  if (MOCK) return loginEmail(email);
  try {
    const res = await fetch(`${BASE}/auth/password/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Registration failed" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function loginPassword(email: string, password: string): Promise<LoginResponse> {
  if (MOCK) return loginEmail(email);
  try {
    const res = await fetch(`${BASE}/auth/password/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Invalid email or password" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function signup(username: string, email: string, password: string): Promise<LoginResponse> {
  if (MOCK) return loginEmail(email);
  try {
    const res = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Signup failed" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function activateSignup(email: string, code: string): Promise<LoginResponse> {
  if (MOCK) return loginEmail(email);
  try {
    const res = await fetch(`${BASE}/auth/signup/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Invalid or expired code" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function onboard(token: string, name: string): Promise<boolean> {
  if (MOCK) return true;
  try {
    const res = await authed(`/auth/onboard`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateProfile(name: string, avatar?: string): Promise<boolean> {
  if (MOCK) return true;
  try {
    const res = await authed(`/auth/me`, {
      method: "PUT",
      body: JSON.stringify({ name, avatar: avatar || undefined }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function trackView(slug: string): Promise<void> {
  if (MOCK) return;
  try {
    await fetch(`${BASE}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ slug, event: "view" }),
    });
  } catch { /* fire-and-forget */ }
}

// ── Epistemic Claims ──────────────────────────────────

export async function fetchArticleClaims(slug: string): Promise<{ claims: any[] } | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/articles/${slug}/claims`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleGaps(slug: string): Promise<{ gaps: any[] } | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/articles/${slug}/gaps`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchClaimEvidence(claimId: string): Promise<{ evidence: any[] } | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/claims/${claimId}/evidence`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export interface FreshnessInfo {
  slug: string;
  overall_score: number;
  claim_freshness: { claim_id: string; text: string; freshness_score: number; evidence_count: number }[];
}

export async function fetchAllGaps(): Promise<{ gaps: any[] } | null> {
  if (MOCK) return { gaps: (mock.MOCK_EPISTEMIC as any).gaps ?? [] };
  const res = await fetch(`${BASE}/gaps`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleFreshness(slug: string): Promise<FreshnessInfo | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/articles/${slug}/freshness`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchRefreshDiff(slug: string): Promise<any | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/articles/${slug}/refresh-diff`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStaleArticles(limit = 50): Promise<{ articles: any[] } | null> {
  if (MOCK) return { articles: [] };
  const res = await fetch(`${BASE}/stale?limit=${limit}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function upvoteGap(gapId: string): Promise<{ gap_id: string; upvotes: number } | null> {
  if (MOCK) return null;
  const res = await authed(`/gaps/${gapId}/upvote`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

export async function submitGapEvidence(gapId: string, url: string, note: string): Promise<any | null> {
  if (MOCK) return null;
  const res = await authed(`/gaps/${gapId}/submit`, {
    method: "POST",
    body: JSON.stringify({ url, note }),
  });
  if (!res.ok) return null;
  return res.json();
}

export interface GraphNode {
  id: string; type: string; label: string;
  status?: string; confidence?: number;
}

export interface GraphLink {
  source: string; target: string; type: string;
}

export async function fetchArticleGraph(slug: string): Promise<{ nodes: GraphNode[]; links: GraphLink[] } | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/articles/${slug}/graph`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

// ── Claim-level graph ──────────────────────────────────

export interface ClaimGraphNode {
  id: string;
  type: "claim" | "evidence" | "source";
  label: string;
  short_label?: string;
  status?: string;
  confidence?: number;
  supports?: boolean;
  chain_of_custody?: string;
  accessibility?: string;
  confidence_vector?: Record<string, number>;
  contradiction_level?: number;
  article_slug?: string;
  article_title?: string;
}

export interface ClaimGraphEdge {
  source: string;
  target: string;
  type: "evidence" | "claim";
  relationship: string; // supports | contradicts | related | evidence
  strength?: number;
}

export async function fetchArticleClaimGraph(slug: string): Promise<{ nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[] } | null> {
  if (MOCK) return { nodes: (mock.MOCK_SPINO_NODES as any), edges: (mock.MOCK_SPINO_EDGES as any) };
  const res = await fetch(`${BASE}/articles/${slug}/claim-graph`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchArticleEpistemic(slug: string): Promise<{
  slug: string;
  claims: any[];
  gaps: any[];
  freshness: { overall_score: number; claim_freshness: any[] };
  refresh_diff: any;
  claim_graph: { nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[] };
} | null> {
  if (MOCK) return mock.MOCK_EPISTEMIC;
  const res = await fetch(`${BASE}/articles/${slug}/epistemic`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchGlobalClaimGraph(limit = 150, minContradiction = 0): Promise<{
  nodes: (ClaimGraphNode & { article_slug?: string })[];
  edges: ClaimGraphEdge[];
  claim_count: number;
  min_contradiction: number;
} | null> {
  if (MOCK) return (mock as any).buildMockGlobal ? (mock as any).buildMockGlobal(limit) : mock.MOCK_GLOBAL_CLAIM_GRAPH as any;
  const res = await fetch(`${BASE}/claim-graph?limit=${limit}&min_contradiction=${minContradiction}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchContestedClaims(limit = 50): Promise<{ claims: any[] } | null> {
  if (MOCK) return { claims: (mock.MOCK_EPISTEMIC as any).claims ?? [] };
  const res = await fetch(`${BASE}/contested?limit=${limit}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

// ── Admin ────────────────────────────────────────────────

export async function fetchSettings(): Promise<Record<string, string>> {
  if (MOCK) return mock.MOCK_SETTINGS;
  const res = await fetch(`${BASE}/admin/settings`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) return {};
  return res.json();
}

export async function updateSettings(settings: Record<string, string>): Promise<boolean> {
  if (MOCK) return true;
  const res = await authed(`/admin/settings`, {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  return res.ok;
}

export async function fetchFeaturedArticles(): Promise<ArticleSummary[]> {
  if (MOCK) return mock.MOCK_ARTICLE_SUMMARIES.slice(0, 3);
  // ponytail: public /featured resolves slugs server-side — the homepage
  // must never ride admin-gated GET /admin/settings (401s anonymously).
  const res = await fetch(`${BASE}/featured`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return [];
  const articles = await res.json();
  if (!Array.isArray(articles)) return [];
  return articles.map((a: any) => ({ slug: a.slug, title: a.title, abstract: a.abstract, metadata: a.metadata, categories: a.categories }));
}

// ── Models (LLM Gateway) ──

export interface ModelSpec {
  name: string;
  provider: string;
  displayName: string;
  reasoning: boolean;
  toolCall: boolean;
  attachment: boolean;
  contextLimit?: number;
  outputLimit?: number;
  inputCostPerM?: number;
  outputCostPerM?: number;
}

export async function fetchModels(): Promise<ModelSpec[]> {
  if (MOCK) return mock.MOCK_MODELS;
  const res = await fetch(`${BASE}/v1/llm/models`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.value ?? json.models ?? json;
}

// ── Connectors (Executor Gateway) ──

export interface ConnectorSummary {
  slug: string;
  name: string;
  provider: string;
  actions: { name: string; risk: string }[];
}

export async function fetchConnectors(): Promise<ConnectorSummary[]> {
  if (MOCK) return mock.MOCK_CONNECTORS;
  const res = await fetch(`${BASE}/v1/executor/connectors`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.value ?? json.connectors ?? json;
}

// ── Credentials ──

export async function updateCredential(service: string, token: string): Promise<boolean> {
  if (MOCK) return true;
  const res = await authed(`/v1/credentials`, {
    method: "PATCH",
    body: JSON.stringify({ service, token }),
  });
  return res.ok;
}

// ── LLM Usage Stats ──

export interface UsageStats {
  userId: string;
  totals: { totalTokens: number; totalCost: number; callCount: number };
  recent: { model: string; tokens: number; cost: number; timestamp: string }[];
}

export async function fetchUsageStats(): Promise<UsageStats | null> {
  if (MOCK) return mock.MOCK_USAGE;
  const res = await fetch(`${BASE}/v1/llm/usage`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

// ── Queue ──────────────────────────────────────────────────────

export interface QueueJob {
  slug: string;
  title?: string;
  status: string;
  phase: string;
  createdAt: string;
  error?: string;
  agentEvents?: unknown[];
}

export interface QueueStats {
  queued: number;
  active: number;
  maxConcurrent: number;
  maxQueue: number;
}

export interface QueueData {
  jobs: QueueJob[];
  stats: QueueStats;
}

export async function fetchQueue(): Promise<QueueData | null> {
  if (MOCK) return { jobs: [], stats: { queued: 0, active: 0, maxConcurrent: 3, maxQueue: 10 } };
  const res = await fetch(`${BASE}/queue`, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function cancelQueueJob(slug: string): Promise<boolean> {
  if (MOCK) return true;
  const res = await authed(`/queue/${slug}`, { method: "DELETE" });
  return res.ok;
}

// ── Seed Trickle (admin ops) ─────────────────────────────────────

export interface SeedStatus {
  paused: boolean;
  schedule: string;
  next_tick: string;
  today: { date: string; count: number; limit: number };
  bench: { total: number; live: string[]; pending: string[] };
  auto_gaps: boolean;
}

export async function fetchSeedStatus(): Promise<SeedStatus | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/seed/status`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function runSeedNow(force = false): Promise<{ queued: string; reason: string } | null> {
  if (MOCK) return null;
  const res = await authed(`/seed/run${force ? "?force=1" : ""}`, { method: "POST" });
  return res.json().catch(() => null);
}

export async function setSeedPaused(paused: boolean): Promise<boolean> {
  if (MOCK) return true;
  const res = await authed(`/seed/pause`, {
    method: "POST",
    body: JSON.stringify({ paused }),
  });
  return res.ok;
}

// ── Site Coordinator (admin ops) ───────────────────────────────

export interface CoordinatorRun {
  at: string;
  featured: string[];
  stale_queued: string;
  reason: string;
}

export interface CoordinatorStatus {
  paused: boolean;
  schedule: string;
  next_tick: string;
  today: { date: string; count: number; limit: number };
  last_run: CoordinatorRun | null;
}

export async function fetchCoordinatorStatus(): Promise<CoordinatorStatus | null> {
  if (MOCK) return null;
  const res = await fetch(`${BASE}/coordinator/status`, { cache: "no-store", headers: { ...authHeaders() }, credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export async function runCoordinatorNow(force = false): Promise<CoordinatorRun | null> {
  if (MOCK) return null;
  const res = await authed(`/coordinator/run${force ? "?force=1" : ""}`, { method: "POST" });
  return res.json().catch(() => null);
}

// ── Article Resolve (paused review flow) ───────────────────────

export async function resolveArticle(slug: string, action: "approve" | "correct"): Promise<boolean> {
  if (MOCK) return true;
  const res = await authed(`/articles/${slug}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  return res.ok;
}

// ── Article Contest (reader challenge → adjudication → conditional regen) ──

export interface ContestResult {
  status: "queued" | "no_change" | "busy" | "undecided";
  reasoning?: string;
  error?: string;
  contestation_id?: string;
  slug?: string;
}

export async function contestArticle(slug: string, argument: string): Promise<ContestResult> {
  if (MOCK) return { status: "no_change", reasoning: "Mock mode: challenge recorded, article stands." };
  try {
    const res = await authed(`/articles/${slug}/contest`, {
      method: "POST",
      body: JSON.stringify({ argument }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { status: "undecided", error: "Please log in to contest this article." };
    if (res.status === 429) return { status: "busy", error: data.error || "A generation is already running" };
    if (!res.ok) return { status: "undecided", error: data.error || "Contest failed" };
    return data;
  } catch {
    return { status: "undecided", error: "Network error" };
  }
}

// ── Health (home page stats) ───────────────────────────────────

export async function fetchHealth(): Promise<{ article_count?: number } | null> {
  if (MOCK) return { article_count: 0 };
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Stripe (legacy 501 stubs — billing is Paystack, do not use) ─────

export async function stripeCheckout(priceId: string): Promise<{ url?: string } | null> {
  if (MOCK) return null;
  try {
    const res = await fetch(`${BASE}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() }, credentials: "include",
      body: JSON.stringify({ priceId }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function stripePortal(): Promise<{ url?: string } | null> {
  if (MOCK) return null;
  try {
    const res = await fetch(`${BASE}/stripe/portal`, { headers: { ...authHeaders() }, credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Paystack (billing — F3) ────────────────────────────────────

export async function paystackInit(tier: string): Promise<{ authorization_url?: string; reference?: string; error?: string } | null> {
  if (MOCK) return { authorization_url: "/", reference: "mock-ref" };
  try {
    const res = await authed(`/paystack/initialize`, {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Billing unavailable" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

export async function paystackVerify(reference: string): Promise<{ status?: string; tier?: string; error?: string } | null> {
  if (MOCK) return { status: "success", tier: "pro" };
  try {
    const res = await authed(`/paystack/verify/${encodeURIComponent(reference)}`, {});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Payment not confirmed" };
    return data;
  } catch {
    return { error: "Network error" };
  }
}

// ── JWT payload decode (no dependency, works client-side) ──

export interface JwtPayload {
  sub?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch { return null; }
}

export type { Article, JobInfo, ArticleSummary, QuotaInfo, ConversationSummary, ConversationDetail, MapEntry, Section, MediaItem, TimelineEvent, CrossReference, Citation } from "@encarta/core";
