import { Hono } from "hono";
import { pingDb } from "@encarta/storage";
import { dbReady, dbError, APP_VERSION } from "../shared.js";

const health = new Hono();

health.get("/health", async (c) => {
  if (dbError) {
    return c.json({ status: "degraded", dbReady: false, dbError, version: APP_VERSION }, 503);
  }
  if (!dbReady) {
    return c.json({ status: "starting", dbReady: false, version: APP_VERSION }, 503);
  }
  const pingOk = await pingDb();
  if (!pingOk) {
    return c.json({ status: "degraded", dbReady: false, dbError: "MongoDB ping failed", version: APP_VERSION }, 503);
  }
  return c.json({ status: "ok", dbReady: true, version: APP_VERSION });
});

export default health;
