import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
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
} from "@encarta/storage";
import { queue } from "@encarta/core";
import type { Article, ArticleContent, ArticleMetadata } from "@encarta/core";
import { authMiddleware } from "./auth.js";
import { rateLimitMiddleware } from "./rateLimit.js";
import {
  articleParamsSchema,
  searchQuerySchema,
  listQuerySchema,
} from "./validation.js";

const app = new Hono();

// Global middleware
app.use("*", cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use("*", rateLimitMiddleware);
app.use("*", authMiddleware);

function sanitizeError(err: unknown): { error: string } {
  if (err instanceof Error) {
    if (process.env.NODE_ENV === "development") {
      return { error: err.message };
    }
    return { error: "Internal server error" };
  }
  return { error: "Internal server error" };
}

// List articles
app.get("/articles", (c) => {
  const parsed = listQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const { limit, offset } = parsed.data;
  const articles = listArticles(limit, offset);
  return c.json(articles);
});

// Search articles
app.get("/articles/search", (c) => {
  const parsed = searchQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const { q, limit } = parsed.data;
  const results = searchArticles(q, limit);
  return c.json(results);
});

// Get article
app.get("/articles/:slug", (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const article = getArticle(parsed.data.slug);
  if (!article) return c.json({ error: "Article not found", status: "not_generated" }, 404);
  return c.json(article);
});

// Get article status
app.get("/articles/:slug/status", (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const slug = parsed.data.slug;
  const job = queue.getJob(slug);
  if (job && job.status !== "done") return c.json(job);

  const status = getArticleStatus(slug);
  if (!status) return c.json({ status: "not_found" });

  return c.json({ status, slug });
});

// Generate article
app.post("/articles/:slug/generate", async (c) => {
  try {
    const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const slug = parsed.data.slug;
    const existing = getArticle(slug);
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

    queue.enqueue(slug, { persona });
    return c.json({ status: "queued", slug, persona }, 202);
  } catch (err) {
    return c.json(sanitizeError(err), 500);
  }
});

// Refresh article
app.post("/articles/:slug/refresh", async (c) => {
  try {
    const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const slug = parsed.data.slug;
    const existing = getArticle(slug);
    if (!existing) return c.json({ error: "Article not found" }, 404);

    queue.enqueue(slug);
    return c.json({ status: "queued", slug }, 202);
  } catch (err) {
    return c.json(sanitizeError(err), 500);
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

    const job = queue.getJob(slug);
    // Always send an initial event so the client knows the stream is alive
    stream.writeSSE({
      data: JSON.stringify(job || { slug, status: "not_queued", phase: "idle" }),
      event: "progress",
    });

    stream.onAbort(() => {
      unsub();
    });
  });
});

// Graph data
app.get("/articles/:slug/graph", (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

  const slug = parsed.data.slug;
  const edges = getGraphEdges(slug);
  const backlinks = getBacklinks(slug);
  return c.json({ edges, backlinks });
});

// Queue status
app.get("/queue", (c) => {
  return c.json({ jobs: queue.getAllJobs(), stats: queue.getStats() });
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", version: "0.1.0" });
});

async function processArticle(slug: string, meta?: Record<string, string>): Promise<void> {
  const { researchPhase, outlinePhase, writePhase } = await import("@encarta/core");
  const persona = (meta?.persona || "veritas") as import("@encarta/core").Persona;

  queue.updateJob(slug, "researching", { phase: "research" });
  const { result: research, sessionId } = await researchPhase(slug, persona);

  queue.updateJob(slug, "writing", { phase: "outline" });
  const outline = await outlinePhase(sessionId, slug, research, persona);

  queue.updateJob(slug, "writing", { phase: "write" });
  const content = await writePhase(sessionId, slug, research, outline, persona);

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
}

queue.setProcessor(processArticle);

const PORT = parseInt(process.env.PORT || "4097", 10);

if (process.argv[1]?.includes("index") || process.argv[1]?.includes("server")) {
  initDb().then(() => {
    try {
      serve({ fetch: app.fetch, port: PORT });
      console.log(`Encarta-Me API server running on http://localhost:${PORT}`);
      console.log(`Auth: ${process.env.ENCARTA_API_KEYS ? "enabled" : "disabled"}`);
    } catch (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  }).catch((err) => {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });
}

export default app;
