import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Context } from "hono";
import { getUserById } from "@encarta/storage";


export const APP_VERSION = "0.1.0";
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";
export const PUBLIC_URL = process.env.ENCARTA_PUBLIC_URL || process.env.NEXT_PUBLIC_API_URL || "";

export let dbReady = false;
export let dbError: string | null = null;

export function setDbReady(ready: boolean) { dbReady = ready; }
export function setDbError(error: string | null) { dbError = error; }

// Per-slug generation cooldowns (Map<`gen:${slug}`, expiry timestamp>)
export const generationCooldowns = new Map<string, number>();

// ─── Helpers ─────────────────────────────────────────────────────────────

export async function isAdmin(c: any): Promise<boolean> {
  if (c.get("tier") === "admin") return true;
  const userId = getUserId(c);
  if (!userId) return false;
  const user = await getUserById(userId);
  if (!user) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return adminEmails.includes(user.email.toLowerCase());
}

export function getUserId(c: any): string | null {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export function computeETag(data: unknown): string {
  const hash = createHash("md5").update(JSON.stringify(data)).digest("hex");
  return `"${hash}"`;
}

export function setCacheHeaders(c: Context, data: unknown, lastModified?: string): void {
  const etag = computeETag(data);
  c.header("ETag", etag);
  if (lastModified) {
    c.header("Last-Modified", new Date(lastModified).toUTCString());
  }
  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
}

export function checkNotModified(c: Context, etag: string, lastModified?: string): boolean {
  const ifNoneMatch = c.req.header("if-none-match");
  const ifModifiedSince = c.req.header("if-modified-since");
  if (ifNoneMatch && ifNoneMatch === etag) return true;
  if (ifModifiedSince && lastModified) {
    const sinceDate = new Date(ifModifiedSince);
    const modDate = new Date(lastModified);
    if (sinceDate >= modDate) return true;
  }
  return false;
}

export function buildMarkdown(article: any): string {
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
  if (article.timeline?.length > 0) {
    lines.push("## Timeline");
    lines.push("");
    for (const event of article.timeline) {
      lines.push(`- **${event.year}:** ${event.event} — ${event.description}`);
    }
    lines.push("");
  }
  if (article.citations?.length > 0) {
    lines.push("## Citations");
    lines.push("");
    for (let i = 0; i < article.citations.length; i++) {
      const cite = article.citations[i];
      lines.push(`${i + 1}. [${cite.title}](${cite.url}) — ${cite.relevance || ""}`);
    }
    lines.push("");
  }
  if (article.crossrefs?.length > 0) {
    lines.push("## See Also");
    lines.push("");
    for (const ref of article.crossrefs) {
      lines.push(`- [${ref.title}](/article/${ref.id}) — ${ref.relationship}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 2): Promise<T> {
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
