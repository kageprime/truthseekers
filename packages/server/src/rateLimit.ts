import type { Context, Next } from "hono";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = parseInt(process.env.RATE_LIMIT || "60", 10);
const MAX_PER_IP = parseInt(process.env.RATE_LIMIT_IP || "20", 10);
const MAX_PER_KEY = parseInt(process.env.RATE_LIMIT_KEY || "100", 10);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

async function checkRateLimit(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
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

// Periodic cleanup every 60s
setInterval(cleanup, 60_000).unref();
