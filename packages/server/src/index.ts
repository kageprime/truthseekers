import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  searchArticles,
  getArticle,
  getArticleStatus,
  listArticles,
  getGraphEdges,
  getBacklinks,
  upsertArticle,
  commitArticle,
  initDb,
  listMaps,
  listInteractiveMaps,
  searchMaps,
  getMap,
  trackArticleView,
  getArticleViewCount,
  getTopArticles,
  pingDb,
  saveJob,
  loadAllJobs,
  deleteJobDoc,
  createConversation,
  listConversations,
  getConversation,
  getMessages,
  addMessage,
  updateConversationTitle,
  memStore,
  memRecall,
  memRecallAll,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@encarta/storage";
import { queue, articleToBlocks, sendPromptStream, CHAT_TOOL_DEFINITIONS, BUILT_IN_TOOL_EXECUTORS } from "@encarta/core";
import type { Article, ArticleContent, ArticleMetadata, ToolCall, Message, ToolExecutor } from "@encarta/core";
import { authMiddleware } from "./auth.js";
import { rateLimitMiddleware } from "./rateLimit.js";
import { sendSuccess, sendError, requestIdMiddleware, errorMiddleware } from "./response.js";
import { generateImage, generateVideo } from "./imageGen.js";
import {
  articleParamsSchema,
  searchQuerySchema,
  listQuerySchema,
  mapListQuerySchema,
  mapSearchQuerySchema,
} from "./validation.js";
import authRoutes from "./auth-routes.js";
import stripeRoutes from "./stripe.js";
import { getQuota, incrementQuota } from "./quota.js";

const app = new Hono();

const APP_VERSION = "0.1.0";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";
const PUBLIC_URL = process.env.ENCARTA_PUBLIC_URL || process.env.NEXT_PUBLIC_API_URL || "";

function getUserId(c: any): string | null {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}


// Per-slug generation cooldowns (Map<`gen:${slug}`, expiry timestamp>)
const generationCooldowns = new Map<string, number>();

// Parse allowed origins from CORS_ORIGIN env var (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// In development, always allow localhost origins
const devOrigins = process.env.NODE_ENV !== "production"
  ? ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
  : [];

// Serve generated images from root public/images
const publicDir = path.resolve(__dirname, "..", "..", "..", "public");
app.use("/images/*", serveStatic({ root: publicDir, rewriteRequestPath: (p) => p }));

// Request ID + error handling
app.use("*", requestIdMiddleware);
app.onError(errorMiddleware);

// Global middleware
app.use("*", cors({
  origin: (origin) => {
    if (devOrigins.includes(origin)) return origin;
    if (allowedOrigins.length === 0) return null;
    if (allowedOrigins.includes("*")) return origin;
    if (allowedOrigins.includes(origin)) return origin;
    return null;
  },
}));

// Mount auth routes (no auth required)
app.route("/auth", authRoutes);
app.route("/stripe", stripeRoutes);

app.use("*", rateLimitMiddleware);
app.use("*", authMiddleware);



function computeETag(data: unknown): string {
  const hash = createHash("md5").update(JSON.stringify(data)).digest("hex");
  return `"${hash}"`;
}

function setCacheHeaders(c: Context, data: unknown, lastModified?: string): void {
  const etag = computeETag(data);
  c.header("ETag", etag);
  if (lastModified) {
    c.header("Last-Modified", new Date(lastModified).toUTCString());
  }
  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
}

function checkNotModified(c: Context, etag: string, lastModified?: string): boolean {
  const ifNoneMatch = c.req.header("if-none-match");
  const ifModifiedSince = c.req.header("if-modified-since");

  if (ifNoneMatch && ifNoneMatch === etag) {
    return true;
  }

  if (ifModifiedSince && lastModified) {
    const sinceDate = new Date(ifModifiedSince);
    const modDate = new Date(lastModified);
    if (sinceDate >= modDate) {
      return true;
    }
  }

  return false;
}

// List articles
app.get("/articles", async (c) => {
  const parsed = listQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const { limit, offset } = parsed.data;
  const articles = await listArticles(limit + 1, offset);
  const hasMore = articles.length > limit;
  if (hasMore) articles.pop();
  return c.json({
    data: articles,
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  });
});

// Search articles
app.get("/articles/search", async (c) => {
  const parsed = searchQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const { q, limit } = parsed.data;
  const results = await searchArticles(q, limit);
  return c.json(results);
});

// Get article
app.get("/articles/:slug", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const article = await getArticle(parsed.data.slug);
  if (!article) return c.json({ error: "Article not found", status: "not_generated" }, 404);

  const etag = computeETag(article);
  if (checkNotModified(c, etag, article.metadata.updated)) {
    return c.body(null, 304);
  }

  setCacheHeaders(c, article, article.metadata.updated);
  return c.json(article);
});

// Get article status
app.get("/articles/:slug/status", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const slug = parsed.data.slug;
  const job = queue.getJob(slug);
  if (job && job.status !== "done") return c.json(job);

  const status = await getArticleStatus(slug);
  if (!status) return c.json({ status: "not_found" });

  return c.json({ status, slug });
});

// Generate article
app.post("/articles/:slug/generate", async (c) => {
  try {
    const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const slug = parsed.data.slug;

    // Check generation quota
    const quota = await getQuota(c);
    if (!quota.allowed) {
      return c.json({
        error: `Generation limit reached (${quota.tier}: ${quota.limit} articles). Upgrade your plan to generate more.`,
        quota,
      }, 403);
    }

    // Per-slug generation rate limit (1 per 60s)
    const genKey = `gen:${slug}`;
    const genEntry = generationCooldowns.get(genKey);
    if (genEntry && Date.now() < genEntry) {
      return c.json({ error: "Article was recently generated. Please wait before trying again." }, 429);
    }

    const existing = await getArticle(slug);
    if (existing && existing.metadata.status === "published") {
      return c.json({ status: "already_exists", slug });
    }

    let persona = "veritas";
    try {
      const body = await c.req.json();
      if (body?.persona === "pliny") persona = "pliny";
    } catch {
      // no body or invalid JSON, use default
    }

    generationCooldowns.set(genKey, Date.now() + 60_000);
    const userId = getUserId(c);
    const meta: Record<string, string> = { persona, ...(userId ? { generatedBy: userId } : {}) };
    queue.enqueue(slug, meta);
    incrementQuota(c).catch(() => {});
    return c.json({ status: "queued", slug, persona, quota: await getQuota(c) }, 202);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

// Refresh article
app.post("/articles/:slug/refresh", async (c) => {
  try {
    const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const slug = parsed.data.slug;
    const existing = await getArticle(slug);
    if (!existing) return c.json({ error: "Article not found" }, 404);

    // Check generation quota
    const quota = await getQuota(c);
    if (!quota.allowed) {
      return c.json({
        error: `Generation limit reached (${quota.tier}: ${quota.limit} articles). Upgrade your plan to generate more.`,
        quota,
      }, 403);
    }

    queue.enqueue(slug);
    incrementQuota(c).catch(() => {});
    return c.json({ status: "queued", slug, quota: await getQuota(c) }, 202);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

// SSE progress stream
app.get("/articles/:slug/progress", (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const slug = parsed.data.slug;

  return streamSSE(c, async (stream) => {
    let unsub: (() => void) | null = null;
    let unsubAgent: (() => void) | null = null;

    const cleanup = () => {
      if (unsub) { unsub(); unsub = null; }
      if (unsubAgent) { unsubAgent(); unsubAgent = null; }
    };

    // Register abort handler BEFORE subscribing to prevent leak on early disconnect
    stream.onAbort(cleanup);

    unsub = queue.subscribe(slug, (s: string, status: string, info: Record<string, unknown>) => {
      try {
        stream.writeSSE({
          data: JSON.stringify({ slug: s, status, ...info }),
          event: "progress",
        });
      } catch { cleanup(); }
    });

    unsubAgent = queue.subscribeAgentEvents(slug, (s: string, event: import("@encarta/core").AgentEvent) => {
      try {
        stream.writeSSE({
          data: JSON.stringify(event),
          event: "agent_event",
        });
      } catch { cleanup(); }
    });

    const job = queue.getJob(slug);
    // Always send an initial event so the client knows the stream is alive
    try {
      stream.writeSSE({
        data: JSON.stringify(job || { slug, status: "not_queued", phase: "idle" }),
        event: "progress",
      });
    } catch { cleanup(); }
  });
});

// Export article
app.get("/articles/:slug/export", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const article = await getArticle(parsed.data.slug);
  if (!article) return c.json({ error: "Article not found", status: "not_generated" }, 404);

  const format = c.req.query("format") || "json";

  if (format === "json") {
    return c.json(article);
  }

  if (format === "markdown") {
    const md = buildMarkdown(article);
    c.header("Content-Type", "text/markdown");
    c.header("Content-Disposition", `attachment; filename="${article.slug}.md"`);
    return c.body(md);
  }

  return c.json({ error: "Unsupported format. Use 'json' or 'markdown'." }, 400);
});

// Track article view
app.post("/track", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { slug, event } = body as { slug?: string; event?: string };

  if (!slug) {
    return c.json({ error: "Missing slug" }, 400);
  }

  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  await trackArticleView(slug, ip, event || "view");

  return c.json({ status: "tracked" });
});

// Get article view count
app.get("/articles/:slug/views", async (c) => {
  const slug = c.req.param("slug");
  const count = await getArticleViewCount(slug);
  return c.json({ slug, views: count });
});

// Get top articles by views
app.get("/articles/top", async (c) => {
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const top = await getTopArticles(Math.min(limit, 50));
  return c.json({ data: top });
});

function buildMarkdown(article: Article): string {
  const lines: string[] = [];

  lines.push(`# ${article.title}`);
  lines.push("");
  lines.push(`> ${article.abstract}`);
  lines.push("");
  lines.push(`**Version:** ${article.metadata.version} | **Updated:** ${article.metadata.updated}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const section of article.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");

    if (section.media && section.media.length > 0) {
      for (const media of section.media) {
        if (media.src) {
          lines.push(`![${media.caption}](${media.src})`);
        } else if (media.code) {
          lines.push("```");
          lines.push(media.code);
          lines.push("```");
        } else {
          lines.push(`*[Media: ${media.caption}]*`);
        }
        lines.push("");
      }
    }
  }

  if (article.timeline.length > 0) {
    lines.push("## Timeline");
    lines.push("");
    for (const event of article.timeline) {
      lines.push(`- **${event.year}:** ${event.event} — ${event.description}`);
    }
    lines.push("");
  }

  if (article.citations.length > 0) {
    lines.push("## Citations");
    lines.push("");
    for (let i = 0; i < article.citations.length; i++) {
      const cite = article.citations[i];
      lines.push(`${i + 1}. [${cite.title}](${cite.url}) — ${cite.relevance || ""}`);
    }
    lines.push("");
  }

  if (article.crossrefs.length > 0) {
    lines.push("## See Also");
    lines.push("");
    for (const ref of article.crossrefs) {
      lines.push(`- [${ref.title}](/article/${ref.id}) — ${ref.relationship}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Graph data
app.get("/articles/:slug/graph", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const slug = parsed.data.slug;
  const edges = await getGraphEdges(slug);
  const backlinks = await getBacklinks(slug);
  return c.json({ edges, backlinks });
});

// Generation quota
app.get("/quota", async (c) => {
  try {
    const quota = await getQuota(c);
    return c.json(quota);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

// Queue status
app.get("/queue", (c) => {
  try {
    return c.json({ jobs: queue.getAllJobs(), stats: queue.getStats() });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

app.delete("/queue/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const removed = queue.deleteJob(slug);
    if (!removed) return c.json({ error: "Job not found" }, 404);
    try { await deleteJobDoc(slug); } catch { /* ignore mongo delete errors */ }
    return c.json({ status: "removed", slug });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

// Map routes
app.get("/maps", async (c) => {
  const parsed = mapListQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const { limit, offset } = parsed.data;
  const maps = await listMaps(limit + 1, offset);
  const hasMore = maps.length > limit;
  if (hasMore) maps.pop();
  const interactive = await listInteractiveMaps();
  const response = {
    data: maps,
    interactive,
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  };

  const etag = computeETag(response);
  if (checkNotModified(c, etag)) {
    return c.body(null, 304);
  }

  setCacheHeaders(c, response);
  return c.json(response);
});

app.get("/maps/search", async (c) => {
  const parsed = mapSearchQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const { q, limit } = parsed.data;
  const results = await searchMaps(q, limit);
  return c.json(results);
});

app.get("/maps/:slug", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const map = await getMap(parsed.data.slug);
  if (!map) return c.json({ error: "Map not found" }, 404);

  const etag = computeETag(map);
  if (checkNotModified(c, etag, map.updatedAt)) {
    return c.body(null, 304);
  }

  setCacheHeaders(c, map, map.updatedAt);
  return c.json(map);
});

let dbReady = false;
let dbError: string | null = null;

// ── Admin (API Key Management) ───────────────────────────────────────────

app.post("/admin/keys", async (c) => {
  const adminKey = c.req.header("x-api-key");
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const { name, tier } = await c.req.json<{ name: string; tier?: "free" | "pro" | "enterprise" }>();
  if (!name) return c.json({ error: "name is required" }, 400);
  try {
    const result = await createApiKey(name, tier || "free");
    return c.json(result);
  } catch (err) {
    return c.json({ error: "Failed to create API key" }, 500);
  }
});

app.get("/admin/keys", async (c) => {
  const adminKey = c.req.header("x-api-key");
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Admin access required" }, 403);
  }
  try {
    const keys = await listApiKeys();
    return c.json(keys);
  } catch {
    return c.json({ error: "Failed to list API keys" }, 500);
  }
});

app.delete("/admin/keys/:id", async (c) => {
  const adminKey = c.req.header("x-api-key");
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Admin access required" }, 403);
  }
  try {
    await revokeApiKey(c.req.param("id"));
    return c.json({ revoked: true });
  } catch {
    return c.json({ error: "Failed to revoke API key" }, 500);
  }
});

// Health check
app.get("/health", async (c) => {
  if (dbError) {
    return c.json({ status: "degraded", dbReady: false, dbError, version: APP_VERSION }, 503);
  }
  if (!dbReady) {
    return c.json({ status: "starting", dbReady: false, version: APP_VERSION }, 503);
  }
  const pingOk = await pingDb();
  if (!pingOk) {
    return c.json({ status: "degraded", dbReady: false, dbError: "MongoDB ping failed", version: APP_VERSION }, 503);
  }
  return c.json({ status: "ok", dbReady: true, version: APP_VERSION });
});

// ── Chat ───────────────────────────────────────────────────────────────────
// In-memory fallback when MongoDB is unavailable
const memConversations = new Map<string, { id: string; title: string; createdAt: string; updatedAt: string; userId: string }>();
const memMessages = new Map<string, Array<{ id: string; conversationId: string; role: string; content: string; blocks?: any[]; createdAt: string }>>();

app.post("/chat", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  const { title } = await c.req.json<{ title?: string }>();
  const id = randomUUID();
  try {
    const conv = await createConversation(id, title || "New Chat", userId);
    return c.json(conv);
  } catch {
    // Fallback: in-memory
    const now = new Date().toISOString();
    const conv = { id, title: title || "New Chat", createdAt: now, updatedAt: now, userId };
    memConversations.set(id, conv);
    memMessages.set(id, []);
    return c.json(conv);
  }
});

app.get("/chat", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  try {
    const convs = await listConversations(userId);
    return c.json(convs);
  } catch {
    const convs = Array.from(memConversations.values())
      .filter((c: any) => c.userId === userId)
      .map((c: any) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, messageCount: (memMessages.get(c.id) || []).length }))
      .sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt));
    return c.json(convs);
  }
});

app.get("/chat/:id", async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  const id = c.req.param("id");
  try {
    const conv = await getConversation(id);
    if (!conv) return c.json({ error: "Conversation not found" }, 404);
    // For now, skip ownership check on individual conversation read to avoid breaking existing data
    const messages = await getMessages(id);
    return c.json({ ...conv, messages });
  } catch {
    const conv = memConversations.get(id);
    if (!conv) return c.json({ error: "Conversation not found" }, 404);
    // For now, skip ownership check on existing conversations
    const messages = memMessages.get(id) || [];
    return c.json({ ...conv, messages });
  }
});

 
const MAX_TOOL_ITERATIONS = 5;

function memAddMessage(id: string, conversationId: string, role: string, content: string, blocks?: any[]) {
  const now = new Date().toISOString();
  const msgs = memMessages.get(conversationId) || [];
  msgs.push({ id, conversationId, role, content, blocks, createdAt: now });
  memMessages.set(conversationId, msgs);
  const conv = memConversations.get(conversationId);
  if (conv) { conv.updatedAt = now; }
}

app.post("/chat/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const { content, model } = await c.req.json<{ content: string; model?: string }>();
  if (!content) return c.json({ error: "Message content required" }, 400);

  // Try DB first, fall back to in-memory
  let conv: { id: string; title: string; createdAt: string; updatedAt: string } | null = null;
  let existing: Array<{ id: string; conversationId: string; role: string; content: string; blocks?: any[]; createdAt: string }> = [];
  let usingMem = false;

  try {
    conv = await getConversation(conversationId);
    if (!conv) return c.json({ error: "Conversation not found" }, 404);
    const userMsgId = randomUUID();
    await addMessage(userMsgId, conversationId, "user", content);
    existing = await getMessages(conversationId);
  } catch {
    conv = memConversations.get(conversationId) || null;
    if (!conv) return c.json({ error: "Conversation not found" }, 404);
    const userMsgId = randomUUID();
    memAddMessage(userMsgId, conversationId, "user", content);
    existing = memMessages.get(conversationId) || [];
    usingMem = true;
  }

  return streamSSE(c, async (stream) => {
    let fullResponse = "";
    const msgId = randomUUID();

    const onEvent = (event: import("@encarta/core").AgentEvent) => {
      try {
        stream.writeSSE({
          data: JSON.stringify(event),
          event: "agent_event",
        });
      } catch {
        // Client disconnected — ignore write errors
      }
    };

    // Build conversation history for the agent
    const initialMessages: Message[] = existing.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const selectedModel = model || undefined;
    let assistantBlocks: any[] = [];

    const TOOL_SYSTEM_PROMPT = `You are Truthseekers, an AI encyclopedia agent that renders rich content inline. You MUST use render_blocks for ALL structured data — do NOT format timelines, maps, or lists as plain text/Markdown.

CRITICAL RULES:
1. Call the tool immediately. No preamble, no "I can..." or "I cannot..." text before the tool call.
2. You HAVE video generation via generate_video. Never say you lack it.
3. Never output tool plans like ["tool1", "tool2"] in text.
4. Final text response comes AFTER all tool calls. First tool call, then answer.

### render_blocks — SINGLE TOOL FOR ALL RICH CONTENT
Whenever you present structured information, call render_blocks. You can include multiple blocks of different types in a single call.

Timeline data (chronological/historical): Use type "timeline" with events[{ year, event, description }]. Sort chronologically.

Map data (geographic/locations): Use type "map_2d" or "map_3d" with markers[{ lat, lng, title, description? }]. Compute centerLat/centerLng as average of marker coordinates.

Also supports: heading, text, citation, crossref, gallery, diagram (mermaid code), video, divider.

Trigger phrases for timeline: "timeline", "history of", "sequence", "in order", "chronology", "when did", "show me the days/steps/ages"
Trigger phrases for map: "map", "where is", "location", "geography", "places", "cities", "region", "layout of", "territory"

### web_search — search the web for current information
### webfetch — fetch the full content of a specific URL
### article_search — search existing encyclopedia articles
### get_article — look up an existing article by slug
### get_map — look up an existing map by slug
### generate_image — create a custom AI illustration
### generate_video — generate a short AI video clip from a text description via DigitalOcean
### verify_citation — check if a source supports a claim
### suggest_related — find related articles and cross-references
### task — delegate parallel research to a sub-agent
### create_article — queue full article generation
### mem_store — remember user preferences across conversations
### mem_recall — recall stored user preferences`;

    const toolExecutors: Record<string, ToolExecutor> = {
      ...BUILT_IN_TOOL_EXECUTORS,
      get_article: async (a) => {
        const article = await getArticle(a.slug);
        if (!article) return { result: "Article not found" };
        const articleBlocks = article.blocks || articleToBlocks(article.slug, article.title, article.abstract, article.sections, article.timeline, article.crossrefs, article.citations);
        return {
          result: JSON.stringify({ title: article.title, abstract: article.abstract, slug: article.slug, blockCount: articleBlocks.length }),
          blocks: articleBlocks,
        };
      },
      create_article: async (a) => {
        queue.enqueue(a.slug, { persona: "veritas" });
        return { result: JSON.stringify({ queued: true, slug: a.slug }) };
      },
      article_search: async (a) => {
        const results = await searchArticles(a.query, a.maxResults || 5);
        if (results.length === 0) return { result: "No articles found" };
        return {
          result: JSON.stringify(results.map((r) => ({ slug: r.slug, title: r.title, abstract: r.abstract?.slice(0, 300) }))),
        };
      },
      get_map: async (a) => {
        const map = await getMap(a.slug);
        if (!map) return { result: "Map not found" };
        return {
          result: JSON.stringify({
            slug: map.slug, title: map.title, type: map.type,
            region: map.region, era: map.era,
            centerLat: map.centerLat, centerLng: map.centerLng, zoom: map.zoom,
            markerCount: map.markers?.length || 0,
            has3D: !!map.threedScene,
            timelineCount: map.timeline?.length || 0,
          }),
          blocks: map.markers ? [{ type: "map_2d", data: { markers: map.markers, centerLat: map.centerLat, centerLng: map.centerLng, zoom: map.zoom } }] : undefined,
        };
      },
      generate_image: async (a) => {
        const result = await generateImage(a.prompt, { id: `chat-${Date.now()}`, caption: a.caption || "" });
        if (!result) return { result: "Image generation failed" };
        const src = result.url.startsWith("/") && PUBLIC_URL ? `${PUBLIC_URL}${result.url}` : result.url;
        return {
          result: JSON.stringify({ url: src, caption: result.caption }),
          blocks: [{ type: "image", data: { src, caption: result.caption } }],
        };
      },
      generate_video: async (a) => {
        const result = await generateVideo(a.prompt, { id: `chat-${Date.now()}`, caption: a.caption || "" });
        if (!result) return { result: "Video generation failed" };
        const src = result.url.startsWith("/") && PUBLIC_URL ? `${PUBLIC_URL}${result.url}` : result.url;
        return {
          result: JSON.stringify({ url: src, caption: result.caption }),
          blocks: [{ type: "video", data: { src, caption: result.caption } }],
        };
      },
      suggest_related: async (a) => {
        const [edges, backlinks] = await Promise.all([getGraphEdges(a.slug), getBacklinks(a.slug)]);
        if (edges.length === 0 && backlinks.length === 0) return { result: "No related articles found" };
        return { result: JSON.stringify({ outgoing: edges, incoming: backlinks }) };
      },
      task: async (a) => {
        const subTools = Array.isArray(a.tools) && a.tools.length > 0
          ? CHAT_TOOL_DEFINITIONS.filter((t) => a.tools.includes(t.function.name))
          : CHAT_TOOL_DEFINITIONS.filter((t) => t.function.name === "web_search" || t.function.name === "webfetch");
        const subConversation = [{ role: "user" as const, content: a.objective }];
        const subResult = await sendPromptStream(subConversation, undefined, {
          system: "You are a research sub-agent. Use your tools to accomplish the objective. Be concise and factual.",
          tools: subTools,
          temperature: 0.5,
          maxTokens: 4096,
          model: selectedModel,
        });
        return { result: subResult.text || "Sub-agent completed with no output." };
      },
      mem_store: async (a) => {
        await memStore(a.key, a.value);
        return { result: `Stored "${a.key}"` };
      },
      mem_recall: async (a) => {
        const value = await memRecall(a.key);
        return { result: value ?? `No stored value for "${a.key}"` };
      },
    };

    // Inject session context: stored memories + recent conversation summary
    let sessionContext = "";
    try {
      const allMemories = await memRecallAll();
      if (allMemories.length > 0) {
        sessionContext += "\n\n## User Preferences\n" + allMemories.map((m) => `${m.key}: ${m.value}`).join("\n");
      }
    } catch {
      // Memory backend unavailable — proceed without context
    }
    const recentSummary = existing.length > 2
      ? `\n\n## Recent Conversation\nThis conversation has ${existing.length} prior messages. The last user message was: "${content.slice(0, 200)}"`
      : "";
    let contextualSystem = TOOL_SYSTEM_PROMPT + sessionContext + recentSummary;

    try {
      let conversation = [...initialMessages];

      // Phase 3a: Planning — ask LLM to outline its strategy before executing (no event streaming, plan is internal)
      const planResult = await withRetry(
        () => sendPromptStream(conversation, undefined, {
          system: contextualSystem + "\n\nBEFORE calling any tools, output a brief plan as a JSON array of tool names in the order you will call them. E.g. [\"article_search\", \"web_search\", \"webfetch\", \"render_blocks\"]. Then proceed with execution.",
          temperature: 0.5,
          tools: CHAT_TOOL_DEFINITIONS,
          tool_choice: "none",
          model: selectedModel,
        }),
        "chat-planning"
      );
      const planText = planResult.text || "";
      const planMatch = planText.match(/\[[^\]]*\]/);
      let plan: string[] = [];
      if (planMatch) {
        try { plan = JSON.parse(planMatch[0]); } catch { plan = []; }
      }
      if (plan.length > 0) {
        conversation.push({ role: "assistant", content: planText });
        conversation.push({ role: "system", content: `Your plan: ${JSON.stringify(plan)}. Follow this plan order. After executing each tool, move to the next. If a tool result suggests a different approach, you may adapt.` });
      }

      // Tool execution loop
      let iteration = 0;
      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;
        // Reserve the last iteration for "auto" so the LLM can always respond with text
        const shouldForceTool = plan.length > 0 && iteration <= plan.length && iteration < MAX_TOOL_ITERATIONS;
        const toolChoice = shouldForceTool
          ? { type: "function" as const, function: { name: plan[iteration - 1] } }
          : "auto" as const;

        const result = await withRetry(
          () => sendPromptStream(conversation, onEvent, {
            system: contextualSystem,
            temperature: 0.7,
            tools: CHAT_TOOL_DEFINITIONS,
            tool_choice: toolChoice,
            model: selectedModel,
          }),
          `chat-agent-iteration-${iteration}`
        );

        if (!result.toolCalls || result.toolCalls.length === 0) {
          fullResponse = result.text;
          break;
        }

        const toolResults: Array<{ id: string; result: string }> = [];

        for (const tc of result.toolCalls) {
          let args: Record<string, unknown>;
          try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch {
            args = {};
            stream.writeSSE({
              data: JSON.stringify({ type: "status", data: `Warning: malformed tool arguments for ${tc.function.name}`, timestamp: Date.now() }),
              event: "agent_event",
            });
          }
          stream.writeSSE({
            data: JSON.stringify({ type: "tool_use", data: { name: tc.function.name, args }, timestamp: Date.now() }),
            event: "agent_event",
          });

          let toolResult = "";
          try {
            const output = await toolExecutors[tc.function.name]?.(args) ?? { result: `Unknown tool: ${tc.function.name}` };
            toolResult = output.result;
            if (output.blocks) assistantBlocks = assistantBlocks.concat(output.blocks);
          } catch (err) {
            toolResult = `Error executing ${tc.function.name}: ${err instanceof Error ? err.message : String(err)}`;
          }

          stream.writeSSE({
            data: JSON.stringify({ type: "tool_result", data: { name: tc.function.name, result: toolResult.slice(0, 1000) }, timestamp: Date.now() }),
            event: "agent_event",
          });

          toolResults.push({ id: tc.id, result: toolResult });
        }

        conversation.push({
          role: "assistant",
          content: null, // omit preamble text when tool calls are present to avoid contaminating conversation history
          tool_calls: result.toolCalls,
        });

        for (const tr of toolResults) {
          const MAX_TOOL_CONTENT = 1500;
          const truncated = tr.result.length > MAX_TOOL_CONTENT
            ? tr.result.slice(0, MAX_TOOL_CONTENT) + `\n\n[Result truncated (${tr.result.length} total chars)]`
            : tr.result;
          conversation.push({ role: "tool", content: truncated, tool_call_id: tr.id });
        }
      }

      if (iteration >= MAX_TOOL_ITERATIONS) {
        fullResponse = fullResponse || "I've reached the maximum number of tool calls for this response. Let me know if you need more information.";
      }

      // Save assistant response (with blocks from tool results)
      const finalContent = fullResponse || "I processed your request using available tools.";
      const finalBlocks = assistantBlocks.length > 0 ? assistantBlocks : undefined;
      if (usingMem) {
        memAddMessage(msgId, conversationId, "assistant", finalContent, finalBlocks);
      } else {
        await addMessage(msgId, conversationId, "assistant", finalContent, finalBlocks);
      }

      // Update conversation title from first exchange
      if (existing.length <= 1) {
        const firstContent = content.length > 60 ? content.slice(0, 60) + "..." : content;
        try { await updateConversationTitle(conversationId, firstContent); } catch {
          const conv = memConversations.get(conversationId);
          if (conv) conv.title = firstContent;
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const hasBlocks = assistantBlocks.length > 0;
      fullResponse = hasBlocks
        ? "Response generated (some tools encountered an error — images or videos may be missing)."
        : `Error: ${errorMsg}`;
      const blocks = hasBlocks ? assistantBlocks : undefined;
      if (usingMem) {
        memAddMessage(randomUUID(), conversationId, "assistant", fullResponse, blocks);
      } else {
        await addMessage(randomUUID(), conversationId, "assistant", fullResponse, blocks).catch(() => {});
      }
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: "done", msgId, content: fullResponse, blocks }),
          event: "agent_event",
        });
      } catch {
        // Stream closed — done event lost; frontend falls back via useChatStream fallback
      }
      return;
    }

    try {
      await stream.writeSSE({
        data: JSON.stringify({ type: "done", msgId, content: fullResponse, blocks: assistantBlocks.length > 0 ? assistantBlocks : undefined }),
        event: "agent_event",
      });
    } catch {
      // Stream closed — done event lost; frontend falls back
    }
  });
});

async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn(`[${label}] attempt ${attempt + 1} failed, retrying in ${delay}ms: ${err}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("withRetry: unreachable");
}

async function processArticle(slug: string, meta?: Record<string, string>): Promise<void> {
  const {
    researchPhase,
    outlinePhase,
    writePhase,
    verifyPhase,
    mediaPhase,
    applyCorrections,
  } = await import("@encarta/core");
  const persona = (meta?.persona || "veritas") as import("@encarta/core").Persona;

  const onAgentEvent = (event: import("@encarta/core").AgentEvent) => {
    queue.emitAgentEvent(slug, event);
  };

  try {
    queue.updateJob(slug, "researching", { phase: "research" });
    const researchResult = await withRetry(
      () => researchPhase(slug, persona, onAgentEvent), "research"
    );

    queue.updateJob(slug, "writing", { phase: "outline" });
    const outline = await withRetry(
      () => outlinePhase(slug, researchResult, persona, onAgentEvent), "outline"
    );

    queue.updateJob(slug, "writing", { phase: "write" });
    let content = await withRetry(
      () => writePhase(slug, researchResult, outline, persona, onAgentEvent), "write"
    );

    queue.updateJob(slug, "verifying", { phase: "verify" });
    const verification = await withRetry(
      () => verifyPhase(slug, researchResult, content, persona, onAgentEvent), "verify"
    );

    if (!verification.verified || verification.confidenceScore < 0.8) {
      queue.updateJob(slug, "verifying", { phase: "correcting" });
      content = await withRetry(
        () => applyCorrections(slug, content, verification, persona, onAgentEvent), "correcting"
      );
    }

    queue.updateJob(slug, "media", { phase: "generate-media" });
    const mediaResult = await withRetry(
      () => mediaPhase(slug, outline, content, persona, onAgentEvent), "media"
    );

    if (!Array.isArray(content.sections)) {
      console.error(`[processArticle] Invalid content for "${slug}": sections=${JSON.stringify(content.sections)}. Full content keys: ${Object.keys(content).join(", ")}. Abstact present: ${!!content.abstract}`);
      content.sections = [];
    }

    const imageItems: { prompt: string; id: string; caption?: string }[] = [];

    for (const mediaItem of mediaResult.mediaItems || []) {
      for (const section of content.sections) {
        if (section.id === mediaItem.sectionId) {
          const existing = section.media.find((m) => m.id === mediaItem.mediaId);
          if (existing) {
            existing.prompt = mediaItem.prompt || existing.prompt;
            if (mediaItem.type === "diagram" && mediaItem.src) {
              existing.code = mediaItem.src;
            }
            if (mediaItem.type === "image" && mediaItem.prompt) {
              imageItems.push({
                prompt: mediaItem.prompt,
                id: mediaItem.mediaId,
                caption: mediaItem.caption || existing.caption,
              });
            }
          }
        }
      }
    }

    if (imageItems.length > 0) {
      queue.updateJob(slug, "media", { phase: "generating-images" });
      const { generateImagesBatch } = await import("./imageGen.js");
      const generated = await generateImagesBatch(imageItems);

      for (const gen of generated) {
        for (const section of content.sections ?? []) {
          for (const media of section.media ?? []) {
            if (media.id === gen.id) {
              media.src = gen.url;
            }
          }
        }
      }
    }

    queue.updateJob(slug, "storing", { phase: "store" });
    const now = new Date().toISOString();
    const blocks = articleToBlocks(
      slug,
      content.title ?? slug,
      content.abstract ?? "",
      content.sections ?? [],
      content.timeline ?? [],
      content.crossrefs ?? [],
      content.citations ?? [],
    );
    const article: Article = {
      slug,
      title: content.title ?? slug,
      abstract: content.abstract ?? "",
      sections: content.sections ?? [],
      timeline: content.timeline ?? [],
      categories: content.categories ?? [],
      crossrefs: content.crossrefs ?? [],
      citations: content.citations ?? [],
      threedScenes: content.threedScenes ?? [],
      blocks,
      metadata: {
        version: 1,
        created: now,
        updated: now,
        status: "published",
        freshness: now,
        generatedBy: meta?.generatedBy || undefined,
      },
    };

    await upsertArticle(article);
    await commitArticle(article);

    queue.updateJob(slug, "done", { phase: "complete" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[processArticle] Error generating "${slug}": ${errorMsg}`);
    queue.updateJob(slug, "error", {
      phase: "error",
      error: errorMsg,
    });
    throw error;
  }
}

queue.setProcessor(processArticle);

const PORT = parseInt(process.env.PORT || "4097", 10);

async function startServer() {
  try {
    await initDb();
    dbReady = true;
    console.log("Database initialized successfully");

    // Persist queue state changes to MongoDB
    queue.onQueueUpdate(async (slug: string, status: string, info: Record<string, unknown>) => {
      try {
        await saveJob(slug, status, info as any);
      } catch (err) {
        console.error(`[queue-persist] failed to save job ${slug}:`, err);
      }
    });

    // Restore pending jobs from MongoDB into the queue
    const pending = await loadAllJobs();
    for (const job of pending) {
      if (["queued", "researching", "writing", "outlining", "verifying", "correcting", "media", "images", "storing"].includes(job.status)) {
        queue.restoreJob(job.slug, job.status as any, job.phase, job.createdAt, job.meta);
      }
    }
    if (pending.length > 0) {
      console.log(`Restored ${pending.length} pending jobs from MongoDB`);
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error("Failed to initialize DB:", err);
  }

  try {
    const server = serve({ fetch: app.fetch, port: PORT });
    console.log(`Truthseekers API server running on port ${PORT}`);
    console.log(`Auth: ${process.env.ENCARTA_API_KEYS ? "enabled" : "disabled"}`);

    process.on("SIGTERM", () => {
      server.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

// Only auto-start when run directly
const isRunningDirectly =
  process.argv[1] != null &&
  (process.argv[1].includes("server") || process.argv[1].includes("index"));

if (isRunningDirectly || process.env.START_SERVER === "1") {
  startServer().catch((err) => {
    console.error("Unhandled error in startServer:", err);
    process.exit(1);
  });
}

export default app;
