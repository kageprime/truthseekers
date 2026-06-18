import type { Context, Next } from "hono";
import { getRedisClient } from "@encarta/core";

const WINDOW_MS = 60_000;

const TIER_LIMITS: Record<string, number> = {
  anonymous: parseInt(process.env.RATE_LIMIT_ANON || "10", 10),
  free: parseInt(process.env.RATE_LIMIT_FREE || "20", 10),
  pro: parseInt(process.env.RATE_LIMIT_PRO || "100", 10),
  enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE || "1000", 10),
  admin: 999_999,
};

async function checkRateLimit(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClient();
  const redisKey = `ratelimit:${key}`;
  
  const current = await redis.get(redisKey);
  const now = Date.now();
  
  if (!current) {
    await redis.set(redisKey, JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }), "PX", WINDOW_MS);
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }

  const entry = JSON.parse(current);
  if (now > entry.resetAt) {
    await redis.set(redisKey, JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }), "PX", WINDOW_MS);
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  await redis.set(redisKey, JSON.stringify(entry), "PX", Math.max(1, entry.resetAt - now));
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

const SKIPPED_PATHS = ["/queue", "/health", "/admin"];

export async function rateLimitMiddleware(c: Context, next: Next) {
  const path = c.req.path;
  if (SKIPPED_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }

  const tier = (c.get("tier") as string) || "anonymous";
  const limit = TIER_LIMITS[tier] || TIER_LIMITS.anonymous;
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const apiKey = c.get("apiKey") as string | undefined;

  const rateKey = apiKey || ip;
  const result = await checkRateLimit(rateKey, limit);

  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.resetAt));
  c.header("X-RateLimit-Tier", tier);

  if (!result.allowed) {
    return c.json({ error: `Rate limit exceeded (${tier}: ${limit}/min). Upgrade at /admin` }, 429);
  }

  await next();
}
