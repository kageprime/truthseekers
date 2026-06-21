import { Hono } from "hono";
import { createApiKey, listApiKeys, revokeApiKey, setSiteSetting, getAllSiteSettings } from "@encarta/storage";
import { isAdmin } from "../shared.js";

const admin = new Hono();

admin.use("*", async (c, next) => {
  if (!(await isAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  await next();
});

admin.post("/admin/keys", async (c) => {
  const { name, tier } = await c.req.json<{ name: string; tier?: "free" | "pro" | "enterprise" }>();
  if (!name) return c.json({ error: "name is required" }, 400);
  try {
    return c.json(await createApiKey(name, tier || "free"));
  } catch {
    return c.json({ error: "Failed to create API key" }, 500);
  }
});

admin.get("/admin/keys", async (c) => {
  try {
    return c.json(await listApiKeys());
  } catch {
    return c.json({ error: "Failed to list API keys" }, 500);
  }
});

admin.delete("/admin/keys/:id", async (c) => {
  try {
    await revokeApiKey(c.req.param("id"));
    return c.json({ revoked: true });
  } catch {
    return c.json({ error: "Failed to revoke API key" }, 500);
  }
});

// ─── Site Settings ─────────────────────────────────────────────────

admin.get("/admin/settings", async (c) => {
  try {
    return c.json(await getAllSiteSettings());
  } catch {
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

admin.put("/admin/settings", async (c) => {
  try {
    const { settings } = await c.req.json<{ settings: Record<string, string> }>();
    if (!settings) return c.json({ error: "settings object required" }, 400);
    for (const [key, value] of Object.entries(settings)) {
      await setSiteSetting(key, value);
    }
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

export default admin;
