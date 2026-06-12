import { randomUUID } from "node:crypto";
import type { Context } from "hono";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(c: Context, data: T, meta?: Record<string, unknown>, status: number = 200): Response {
  const body: ApiResponse<T> = { success: true, data, requestId: c.get("requestId") || "", meta };
  return c.json(body, status as any);
}

export function sendError(c: Context, error: string, status: number = 400, details?: Record<string, unknown>): Response {
  const body: ApiResponse = { success: false, error, requestId: c.get("requestId") || "", meta: details };
  return c.json(body, status as any);
}

export function requestIdMiddleware(c: Context, next: () => Promise<void>) {
  const requestId = c.req.header("x-request-id") || randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  return next();
}

export function errorMiddleware(err: Error, c: Context): Response {
  console.error(`[${c.get("requestId") || "-"}] Error:`, err);
  const message = process.env.NODE_ENV === "development" ? err.message : "Internal server error";
  return c.json({ success: false, error: message, requestId: c.get("requestId") || "" }, 500);
}
