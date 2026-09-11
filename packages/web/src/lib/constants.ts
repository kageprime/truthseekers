export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097";

if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  // ponytail: loud fallback (S26) — localhost is dev-only. Never silent in prod.
  console.warn("[config] NEXT_PUBLIC_API_URL unset — API calls will target localhost and fail in production.");
}
