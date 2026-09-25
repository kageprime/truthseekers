// ponytail: single env source — unset base targets local backend, warns loudly in prod.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097";

if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  console.warn(
    "[config] NEXT_PUBLIC_API_URL unset — API calls will target localhost and fail in production."
  );
}
