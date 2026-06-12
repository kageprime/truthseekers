import type { Context, Next } from "hono";
import { getDb } from "@encarta/storage";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = parseInt(process.env.RATE_LIMIT || "60", 10);
const MAX_PER_IP = parseInt(process.env.RATE_LIMIT_IP || "20", 10);
const MAX_PER_KEY = parseInt(process.env.RATE_LIMIT_KEY || "100", 10);

async function ensureRateLimitTable(): Promise<void> {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      reset_at INTEGER NOT NULL
    )
  `);
  db.prepare(`DELETE FROM rate_limits WHERE reset_at < ?`).run(Date.now());
}

let tableInitialized = false;

async function checkRateLimit(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (!tableInitialized) {
    await ensureRateLimitTable();
    tableInitialized = true;
  }

  const db = getDb();
  const now = Date.now();

  const entry = db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as { count: number; reset_at: number } | undefined;

  if (!entry || now > entry.reset_at) {
    const resetAt = now + WINDOW_MS;
    db.prepare(
      "INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)"
    ).run(key, resetAt);
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  const newCount = entry.count + 1;
  db.prepare(
    "UPDATE rate_limits SET count = ? WHERE key = ?"
  ).run(newCount, key);

  if (newCount > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.reset_at };
  }

  return { allowed: true, remaining: limit - newCount, resetAt: entry.reset_at };
}

const SKIPPED_PATHS = ["/queue", "/health", "/articles/"];

export async function rateLimitMiddleware(c: Context, next: Next) {
  const path = c.req.path;
  if (SKIPPED_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }

  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const apiKey = c.req.header("x-api-key");

  const key = apiKey || ip;
  const limit = apiKey ? MAX_PER_KEY : MAX_PER_IP;

  const result = await checkRateLimit(key, limit);

  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.resetAt));

  if (!result.allowed) {
    return c.json({ error: "Too many requests. Please slow down." }, 429);
  }

  await next();
}

setInterval(() => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM rate_limits WHERE reset_at < ?`).run(Date.now());
  } catch {
    // cleanup failure is non-fatal
  }
}, 60_000).unref();
