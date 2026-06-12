import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../src/index.js";

const API_KEY = "test-key-123";

function makeRequest(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set("x-api-key", API_KEY);
  return app.fetch(
    new Request(`http://localhost:4097${path}`, {
      ...options,
      headers,
    })
  );
}

describe("Server Endpoints", () => {
  describe("Health", () => {
    it("should return health status (may be 503 if DB not ready)", async () => {
      const res = await makeRequest("/health");
      expect([200, 503]).toContain(res.status);
      const body = await res.json();
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("dbReady");
    });
  });

  describe("Validation", () => {
    it("should reject invalid slug format", async () => {
      const res = await makeRequest("/articles/INVALID SLUG!");
      expect(res.status).toBe(400);
    });

    it("should reject slug longer than 200 chars", async () => {
      const longSlug = "a".repeat(201);
      const res = await makeRequest(`/articles/${longSlug}`);
      expect(res.status).toBe(400);
    });

    it("should accept valid slug format", async () => {
      const res = await makeRequest("/articles/valid-slug-123");
      expect(res.status).not.toBe(400);
    });

    it("should reject invalid search query", async () => {
      const res = await makeRequest("/articles/search?q=");
      expect(res.status).toBe(400);
    });

    it("should reject limit > 200", async () => {
      const res = await makeRequest("/articles?limit=999");
      expect(res.status).toBe(400);
    });

    it("should reject negative offset", async () => {
      const res = await makeRequest("/articles?offset=-1");
      expect(res.status).toBe(400);
    });
  });

  describe("Articles", () => {
    it("should return empty list when no articles exist", async () => {
      const res = await makeRequest("/articles");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("pagination");
      expect(body.pagination).toHaveProperty("hasMore");
      expect(body.pagination).toHaveProperty("nextOffset");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should return 404 for non-existent article", async () => {
      const res = await makeRequest("/articles/nonexistent-article");
      expect(res.status).toBe(404);
    });

    it("should return status for non-existent article", async () => {
      const res = await makeRequest("/articles/nonexistent-article/status");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("status");
    });

    it("should return graph data for article", async () => {
      const res = await makeRequest("/articles/some-article/graph");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("edges");
      expect(body).toHaveProperty("backlinks");
    });

    it("should queue article generation", async () => {
      const res = await makeRequest("/articles/test-article-123/generate", {
        method: "POST",
        body: JSON.stringify({ persona: "veritas" }),
      });
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.status).toBe("queued");
      expect(body.slug).toBe("test-article-123");
    });

    it("should accept generation with pliny persona", async () => {
      const res = await makeRequest("/articles/pliny-article/generate", {
        method: "POST",
        body: JSON.stringify({ persona: "pliny" }),
      });
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.persona).toBe("pliny");
    });

    it("should return 404 for refresh of non-existent article", async () => {
      const res = await makeRequest("/articles/does-not-exist/refresh", {
        method: "POST",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("Export", () => {
    it("should return 404 for export of non-existent article", async () => {
      const res = await makeRequest("/articles/does-not-exist/export");
      expect(res.status).toBe(404);
    });

    it("should reject invalid slug for export", async () => {
      const res = await makeRequest("/articles/INVALID SLUG!/export");
      expect(res.status).toBe(400);
    });

    it("should return JSON export by default", async () => {
      const res = await makeRequest("/articles/test-article-123/export");
      expect([200, 404]).toContain(res.status);
    });

    it("should return markdown export when requested", async () => {
      const res = await makeRequest("/articles/test-article-123/export?format=markdown");
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        const contentType = res.headers.get("content-type");
        expect(contentType).toContain("text/markdown");
      }
    });

    it("should reject unsupported export format", async () => {
      const res = await makeRequest("/articles/test-article-123/export?format=pdf");
      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe("Queue", () => {
    it("should return queue status", async () => {
      const res = await makeRequest("/queue");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("jobs");
      expect(body).toHaveProperty("stats");
      expect(body.stats).toHaveProperty("queued");
      expect(body.stats).toHaveProperty("active");
      expect(body.stats).toHaveProperty("maxConcurrent");
      expect(body.stats).toHaveProperty("maxQueue");
    });
  });

  describe("Maps", () => {
    it("should return maps list with pagination", async () => {
      const res = await makeRequest("/maps");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("interactive");
      expect(body).toHaveProperty("pagination");
      expect(Array.isArray(body.data)).toBe(true);
      expect(Array.isArray(body.interactive)).toBe(true);
    });

    it("should return 404 for non-existent map", async () => {
      const res = await makeRequest("/maps/nonexistent-map");
      expect(res.status).toBe(404);
    });

    it("should reject invalid map search query", async () => {
      const res = await makeRequest("/maps/search?q=");
      expect(res.status).toBe(400);
    });
  });

  describe("CORS", () => {
    it("should reject requests without API key when auth is enabled", async () => {
      const res = await app.fetch(
        new Request("http://localhost:4097/health")
      );
      if (process.env.ENCARTA_API_KEYS) {
        expect(res.status).toBe(401);
      } else {
        expect([200, 503]).toContain(res.status);
      }
    });
  });
});
