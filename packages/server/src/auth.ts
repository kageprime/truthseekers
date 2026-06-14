import type { Context, Next } from "hono";
import { getApiKey, touchApiKey } from "@encarta/storage";

// In-memory cache for API keys to avoid DB hits on every request
const keyCache = new Map<string, { tier: string; active: boolean; cachedAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

// Master admin key from env (for managing keys)
const ADMIN_KEY = process.env.ADMIN_API_KEY || "";

function getCachedKey(key: string): { tier: string; active: boolean } | null {
  const cached = keyCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  keyCache.delete(key);
  return null;
}

function setCachedKey(key: string, data: { tier: string; active: boolean }): void {
  keyCache.set(key, { ...data, cachedAt: Date.now() });
}

export async function authMiddleware(c: Context, next: Next) {
  const key = c.req.header("x-api-key");

  // No key provided — allow but mark as anonymous
  if (!key) {
    c.set("apiKey", null);
    c.set("tier", "anonymous");
    await next();
    return;
  }

  // Check admin key
  if (ADMIN_KEY && key === ADMIN_KEY) {
    c.set("apiKey", key);
    c.set("tier", "admin");
    await next();
    return;
  }

  // Check cache
  const cached = getCachedKey(key);
  if (cached) {
    if (!cached.active) {
      return c.json({ error: "API key has been revoked" }, 401);
    }
    c.set("apiKey", key);
    c.set("tier", cached.tier);
    touchApiKey(key).catch(() => {});
    await next();
    return;
  }

  // Check DB
  try {
    const apiKey = await getApiKey(key);
    if (!apiKey) {
      return c.json({ error: "Invalid API key" }, 401);
    }
    if (!apiKey.active) {
      return c.json({ error: "API key has been revoked" }, 401);
    }
    setCachedKey(key, { tier: apiKey.tier, active: apiKey.active });
    c.set("apiKey", key);
    c.set("tier", apiKey.tier);
    touchApiKey(key).catch(() => {});
    await next();
  } catch {
    // DB unavailable — fall back to env var keys
    const envKeys = (process.env.ENCARTA_API_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
    if (!envKeys.includes(key)) {
      return c.json({ error: "Invalid API key" }, 401);
    }
    c.set("apiKey", key);
    c.set("tier", "enterprise");
    await next();
  }
}
