import { Hono } from "hono";
import { listMaps, listInteractiveMaps, searchMaps, getMap } from "@encarta/storage";
import { mapListQuerySchema, mapSearchQuerySchema, articleParamsSchema } from "../validation.js";
import { computeETag, setCacheHeaders, checkNotModified } from "../shared.js";

const maps = new Hono();

maps.get("/maps", async (c) => {
  const parsed = mapListQuerySchema.safeParse({
    limit: c.req.query("limit"), offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { limit, offset } = parsed.data;
  const result = await listMaps(limit + 1, offset);
  const hasMore = result.length > limit;
  if (hasMore) result.pop();
  const interactive = await listInteractiveMaps();
  const response = { data: result, interactive, pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null } };
  const etag = computeETag(response);
  if (checkNotModified(c, etag)) return c.body(null, 304);
  setCacheHeaders(c, response);
  return c.json(response);
});

maps.get("/maps/search", async (c) => {
  const parsed = mapSearchQuerySchema.safeParse({
    q: c.req.query("q"), limit: c.req.query("limit"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { q, limit } = parsed.data;
  return c.json(await searchMaps(q, limit));
});

maps.get("/maps/:slug", async (c) => {
  const parsed = articleParamsSchema.safeParse({ slug: c.req.param("slug") });
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const map = await getMap(parsed.data.slug);
  if (!map) return c.json({ error: "Map not found" }, 404);
  const etag = computeETag(map);
  if (checkNotModified(c, etag, map.updatedAt)) return c.body(null, 304);
  setCacheHeaders(c, map, map.updatedAt);
  return c.json(map);
});

export default maps;
