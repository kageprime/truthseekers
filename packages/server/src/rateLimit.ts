import type { Context, Next } from "hono";

const counters = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = parseInt(process.env.RATE_LIMIT || "60", 10);

export async function rateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const key = c.req.header("x-api-key") || ip;
  const now = Date.now();

  let entry = counters.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    counters.set(key, entry);
  } else {
    entry.count++;
  }

  if (entry.count > MAX_PER_WINDOW) {
    return c.json({ error: "Too many requests. Please slow down." }, 429);
  }

  await next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}, 60_000).unref();
