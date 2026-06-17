import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  listArticles, searchArticles, getArticle, getArticleStatus,
  getGraphEdges, getBacklinks,
  trackArticleView, getArticleViewCount, getTopArticles,
  deleteJobDoc,
} from "@encarta/storage";
import { queue } from "@encarta/core";
import { getQuota, incrementQuota } from "../quota.js";
import {
  articleParamsSchema, searchQuerySchema, listQuerySchema,
} from "../validation.js";
import {
  getUserId, computeETag, setCacheHeaders, checkNotModified,
  buildMarkdown, generationCooldowns,
} from "../shared.js";

const articles = new Hono();

// List articles
articles.get("/articles", async (c) => {
  const parsed = listQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { limit, offset } = parsed.data;
  const result = await listArticles(limit + 1, offset);
  const hasMore = result.length > limit;
  if (hasMore) result.pop();
  return c.json({
    data: result,
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  });
});

// Search articles
articles.get("/articles/search", async (c) => {
  const parsed = searchQuerySchema.safeParse({
    q: c.req.query("q"), limit: c.req.query("limit"), offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { q, limit } = parsed.data;
  return c.json(await searchArticles(q, limit));
});

// Get article
articles.get("/articles/:slug", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const article = await getArticle(parsed.data.slug);
  if (!article) return c.json({ error: "Article not found", status: "not_generated" }, 404);
  const etag = computeETag(article);
  if (checkNotModified(c, etag, article.metadata.updated)) return c.body(null, 304);
  setCacheHeaders(c, article, article.metadata.updated);
  return c.json(article);
});

// Get article status
articles.get("/articles/:slug/status", async (c) => {
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
articles.post("/articles/:slug/generate", async (c) => {
  try {
    const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const slug = parsed.data.slug;
    const quota = await getQuota(c);
    if (!quota.allowed) {
      return c.json({
        error: `Generation limit reached (${quota.tier}: ${quota.limit} articles). Upgrade your plan to generate more.`,
        quota,
      }, 403);
    }
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
    } catch {}
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
articles.post("/articles/:slug/refresh", async (c) => {
  try {
    const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const slug = parsed.data.slug;
    const existing = await getArticle(slug);
    if (!existing) return c.json({ error: "Article not found" }, 404);
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
articles.get("/articles/:slug/progress", (c) => {
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
    stream.onAbort(cleanup);
    unsub = queue.subscribe(slug, (s: string, status: string, info: Record<string, unknown>) => {
      try {
        stream.writeSSE({ data: JSON.stringify({ slug: s, status, ...info }), event: "progress" });
      } catch { cleanup(); }
    });
    unsubAgent = queue.subscribeAgentEvents(slug, (s: string, event: import("@encarta/core").AgentEvent) => {
      try {
        stream.writeSSE({ data: JSON.stringify(event), event: "agent_event" });
      } catch { cleanup(); }
    });
    const job = queue.getJob(slug);
    try {
      stream.writeSSE({
        data: JSON.stringify(job || { slug, status: "not_queued", phase: "idle" }),
        event: "progress",
      });
    } catch { cleanup(); }
  });
});

// Export article
articles.get("/articles/:slug/export", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const article = await getArticle(parsed.data.slug);
  if (!article) return c.json({ error: "Article not found", status: "not_generated" }, 404);
  const format = c.req.query("format") || "json";
  if (format === "json") return c.json(article);
  if (format === "markdown") {
    const md = buildMarkdown(article);
    c.header("Content-Type", "text/markdown");
    c.header("Content-Disposition", `attachment; filename="${article.slug}.md"`);
    return c.body(md);
  }
  return c.json({ error: "Unsupported format. Use 'json' or 'markdown'." }, 400);
});

// Track article view
articles.post("/track", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { slug, event } = body as { slug?: string; event?: string };
  if (!slug) return c.json({ error: "Missing slug" }, 400);
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  await trackArticleView(slug, ip, event || "view");
  return c.json({ status: "tracked" });
});

// Article view count
articles.get("/articles/:slug/views", async (c) => {
  const slug = c.req.param("slug");
  return c.json({ slug, views: await getArticleViewCount(slug) });
});

// Top articles
articles.get("/articles/top", async (c) => {
  const limit = parseInt(c.req.query("limit") || "10", 10);
  return c.json({ data: await getTopArticles(Math.min(limit, 50)) });
});

// Graph data
articles.get("/articles/:slug/graph", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const slug = parsed.data.slug;
  return c.json({ edges: await getGraphEdges(slug), backlinks: await getBacklinks(slug) });
});

// Generation quota
articles.get("/quota", async (c) => {
  try {
    return c.json(await getQuota(c));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

// Queue status
articles.get("/queue", (c) => {
  try {
    return c.json({ jobs: queue.getAllJobs(), stats: queue.getStats() });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

articles.delete("/queue/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const removed = queue.deleteJob(slug);
    if (!removed) return c.json({ error: "Job not found" }, 404);
    try { await deleteJobDoc(slug); } catch {}
    return c.json({ status: "removed", slug });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

export default articles;
