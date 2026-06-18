import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { initDb, saveJob, loadAllJobs } from "@encarta/storage";
import { queue } from "@encarta/core";
import { authMiddleware } from "./auth.js";
import { rateLimitMiddleware } from "./rateLimit.js";
import { requestIdMiddleware, errorMiddleware } from "./response.js";
import { setDbReady, setDbError } from "./shared.js";
import { processArticle } from "./processor.js";
import healthRoutes from "./routes/health-routes.js";
import articleRoutes from "./routes/article-routes.js";
import mapRoutes from "./routes/map-routes.js";
import chatRoutes from "./routes/chat-routes.js";
import adminRoutes from "./routes/admin-routes.js";
import authRoutes from "./auth-routes.js";
import stripeRoutes from "./stripe.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT || "4097", 10);

// ─── CORS ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",").map((o) => o.trim()).filter(Boolean);
const devOrigins = process.env.NODE_ENV !== "production"
  ? ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
  : [];

// Static files
const publicDir = path.resolve(__dirname, "..", "..", "..", "public");
app.use("/images/*", serveStatic({ root: publicDir, rewriteRequestPath: (p) => p }));

// Request ID + error handling + compression
app.use("*", compress());
app.use("*", requestIdMiddleware);
app.onError(errorMiddleware);

// CORS
app.use("*", cors({
  origin: (origin) => {
    if (devOrigins.includes(origin)) return origin;
    if (allowedOrigins.length === 0) return null;
    if (allowedOrigins.includes("*")) return origin;
    if (allowedOrigins.includes(origin)) return origin;
    return null;
  },
}));

// No-auth routes
app.route("/auth", authRoutes);
app.route("/stripe", stripeRoutes);

// Auth-required routes
app.use("*", rateLimitMiddleware);
app.use("*", authMiddleware);

// Mount all route modules
app.route("/", healthRoutes);
app.route("/", articleRoutes);
app.route("/", mapRoutes);
app.route("/", chatRoutes);
app.route("/", adminRoutes);

// ─── Queue Processor ──────────────────────────────────────────────────────
queue.setProcessor(processArticle);

// ─── Server Start ────────────────────────────────────────────────────────
async function startServer() {
  try {
    await initDb();
    setDbReady(true);
    console.log("Database initialized successfully");

    queue.onQueueUpdate(async (slug: string, status: string, info: Record<string, unknown>) => {
      try { await saveJob(slug, status, info as any); } catch (err) {
        console.error(`[queue-persist] failed to save job ${slug}:`, err);
      }
    });

    const pending = await loadAllJobs();
    for (const job of pending) {
      if (["queued", "researching", "writing", "outlining", "verifying", "correcting", "media", "images", "storing"].includes(job.status)) {
        queue.restoreJob(job.slug, job.status as any, job.phase, job.createdAt, job.meta);
      }
    }
    if (pending.length > 0) {
      console.log(`Restored ${pending.length} pending jobs from MongoDB`);
    }
  } catch (err) {
    setDbError(err instanceof Error ? err.message : String(err));
    console.error("Failed to initialize DB:", err);
  }

  try {
    const server = serve({ fetch: app.fetch, port: PORT });
    console.log(`Truthseekers API server running on port ${PORT}`);
    console.log(`Auth: ${process.env.ENCARTA_API_KEYS ? "enabled" : "disabled"}`);

    process.on("SIGTERM", () => {
      server.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

const isRunningDirectly =
  process.argv[1] != null &&
  (process.argv[1].includes("server") || process.argv[1].includes("index"));

if (isRunningDirectly || process.env.START_SERVER === "1") {
  startServer().catch((err) => {
    console.error("Unhandled error in startServer:", err);
    process.exit(1);
  });
}

export default app;
