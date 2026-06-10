import type { Context, Next } from "hono";

const API_KEYS = new Set(
  (process.env.ENCARTA_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
);

const AUTH_ENABLED = API_KEYS.size > 0;

export async function authMiddleware(c: Context, next: Next) {
  if (!AUTH_ENABLED) {
    await next();
    return;
  }

  const key = c.req.header("x-api-key");
  if (!key || !API_KEYS.has(key)) {
    return c.json({ error: "Unauthorized — invalid or missing x-api-key header" }, 401);
  }

  await next();
}
