import type { Context } from "hono";
import jwt from "jsonwebtoken";
import {
  getUserGenerationCount,
  incrementUserGenerationCount,
  getApiKeyGenerationCount,
  incrementApiKeyGenerationCount,
} from "@encarta/storage";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";

const GENERATION_LIMITS: Record<string, number> = {
  anonymous: parseInt(process.env.QUOTA_ANON || "3", 10),
  free: parseInt(process.env.QUOTA_FREE || "10", 10),
  pro: parseInt(process.env.QUOTA_PRO || "100", 10),
  enterprise: parseInt(process.env.QUOTA_ENTERPRISE || "999999", 10),
  admin: 999999,
};

export interface QuotaInfo {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  tier: string;
}

const anonCounters = new Map<string, number>();

function getAnonCount(ip: string): number {
  return anonCounters.get(ip) || 0;
}

function incrementAnonCount(ip: string): number {
  const count = (anonCounters.get(ip) || 0) + 1;
  anonCounters.set(ip, count);
  if (anonCounters.size > 10000) {
    anonCounters.clear();
  }
  return count;
}

function getUserIdFromReq(c: Context): string | null {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export async function getQuota(c: Context): Promise<QuotaInfo> {
  const tier = (c.get("tier") as string) || "anonymous";
  const apiKey = c.get("apiKey") as string | undefined;
  const limit = GENERATION_LIMITS[tier] ?? GENERATION_LIMITS.anonymous;

  let identity: { type: "user" | "apikey" | "anon"; id: string } | null = null;

  if (apiKey && tier !== "anonymous") {
    identity = { type: "apikey", id: apiKey };
  } else {
    const userId = getUserIdFromReq(c);
    if (userId) {
      identity = { type: "user", id: userId };
    }
  }

  let used = 0;
  if (identity?.type === "user") {
    used = await getUserGenerationCount(identity.id);
  } else if (identity?.type === "apikey") {
    used = await getApiKeyGenerationCount(identity.id);
  } else {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    used = getAnonCount(ip);
  }

  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, used, limit, remaining, tier };
}

export async function incrementQuota(c: Context): Promise<number> {
  const tier = (c.get("tier") as string) || "anonymous";
  const apiKey = c.get("apiKey") as string | undefined;

  if (apiKey && tier !== "anonymous") {
    return incrementApiKeyGenerationCount(apiKey);
  }

  const userId = getUserIdFromReq(c);
  if (userId) {
    return incrementUserGenerationCount(userId);
  }

  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  return incrementAnonCount(ip);
}
