import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHash } from "node:crypto";
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
} from "@encarta/storage";
import { queue } from "@encarta/core";
import type { Article, ArticleContent, ArticleMetadata } from "@encarta/core";
import { authMiddleware } from "./auth.js";
import { rateLimitMiddleware } from "./rateLimit.js";
import { sendSuccess, sendError, requestIdMiddleware, errorMiddleware } from "./response.js";
import {
  articleParamsSchema,
  searchQuerySchema,
  listQuerySchema,
  mapListQuerySchema,
  mapSearchQuerySchema,
} from "./validation.js";

const app = new Hono();

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

// Skip rate limiting for status/polling endpoints
app.use("/queue", async (c, next) => { await next(); });
app.use("/health", async (c, next) => { await next(); });
app.use("/articles/:slug/progress", async (c, next) => { await next(); });

app.use("*", rateLimitMiddleware);
app.use("*", authMiddleware);



function computeETag(data: unknown): string {
  const hash = createHash("md5").update(JSON.stringify(data)).digest("hex");
  return `"${hash}"`;
}

function setCacheHeaders(c: any, data: unknown, lastModified?: string): void {
  const etag = computeETag(data);
  c.header("ETag", etag);
  if (lastModified) {
    c.header("Last-Modified", new Date(lastModified).toUTCString());
  }
  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
}

function checkNotModified(c: any, etag: string, lastModified?: string): boolean {
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
    queue.enqueue(slug, { persona });
    return c.json({ status: "queued", slug, persona }, 202);
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

    queue.enqueue(slug);
    return c.json({ status: "queued", slug }, 202);
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
    const unsub = queue.subscribe(slug, (s: string, status: string, info: Record<string, unknown>) => {
      stream.writeSSE({
        data: JSON.stringify({ slug: s, status, ...info }),
        event: "progress",
      });
    });

    const unsubAgent = queue.subscribeAgentEvents(slug, (s: string, event: import("@encarta/core").AgentEvent) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: "agent_event",
      });
    });

    const job = queue.getJob(slug);
    // Always send an initial event so the client knows the stream is alive
    stream.writeSSE({
      data: JSON.stringify(job || { slug, status: "not_queued", phase: "idle" }),
      event: "progress",
    });

    stream.onAbort(() => {
      unsub();
      unsubAgent();
    });
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

// Health check
app.get("/health", async (c) => {
  if (dbError) {
    return c.json({ status: "degraded", dbReady: false, dbError, version: "0.1.0" }, 503);
  }
  if (!dbReady) {
    return c.json({ status: "starting", dbReady: false, version: "0.1.0" }, 503);
  }
  const pingOk = await pingDb();
  if (!pingOk) {
    return c.json({ status: "degraded", dbReady: false, dbError: "MongoDB ping failed", version: "0.1.0" }, 503);
  }
  return c.json({ status: "ok", dbReady: true, version: "0.1.0" });
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
  throw new Error("unreachable");
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
        for (const section of content.sections) {
          for (const media of section.media) {
            if (media.id === gen.id) {
              media.src = gen.url;
            }
          }
        }
      }
    }

    queue.updateJob(slug, "storing", { phase: "store" });
    const now = new Date().toISOString();
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
      metadata: {
        version: 1,
        created: now,
        updated: now,
        status: "published",
        freshness: now,
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
