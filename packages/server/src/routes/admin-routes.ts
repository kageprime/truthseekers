import { Hono } from "hono";
import { createApiKey, listApiKeys, revokeApiKey } from "@encarta/storage";

const admin = new Hono();

function checkAdminKey(c: any): boolean {
  const adminKey = c.req.header("x-api-key");
  return !!(adminKey && adminKey === process.env.ADMIN_API_KEY);
}

admin.post("/admin/keys", async (c) => {
  if (!checkAdminKey(c)) return c.json({ error: "Admin access required" }, 403);
  const { name, tier } = await c.req.json<{ name: string; tier?: "free" | "pro" | "enterprise" }>();
  if (!name) return c.json({ error: "name is required" }, 400);
  try {
    return c.json(await createApiKey(name, tier || "free"));
  } catch {
    return c.json({ error: "Failed to create API key" }, 500);
  }
});

admin.get("/admin/keys", async (c) => {
  if (!checkAdminKey(c)) return c.json({ error: "Admin access required" }, 403);
  try {
    return c.json(await listApiKeys());
  } catch {
    return c.json({ error: "Failed to list API keys" }, 500);
  }
});

admin.delete("/admin/keys/:id", async (c) => {
  if (!checkAdminKey(c)) return c.json({ error: "Admin access required" }, 403);
  try {
    await revokeApiKey(c.req.param("id"));
    return c.json({ revoked: true });
  } catch {
    return c.json({ error: "Failed to revoke API key" }, 500);
  }
});

export default admin;
