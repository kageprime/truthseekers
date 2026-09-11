// Shared URL guard for backend-controlled content (S20).
// Only http(s):// and root-relative / paths pass. Everything else —
// javascript:, data:, vbscript:, protocol-relative // — is rejected.
// Use safeUrl for anchors (falls back to "#"), safeSrc for media (falls
// back to undefined so React omits the attribute and nothing loads).

export function safeUrl(u?: string | null): string {
  if (!u) return "#";
  const t = u.trim();
  if (t.length === 0) return "#";
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return "#";
}

export function safeSrc(u?: string | null): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  if (t.length === 0) return undefined;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return undefined;
}

// safeCheckoutUrl validates a payment redirect URL (Paystack — F3).
// Only https: passes; a compromised/proxied response must never become
// an open redirect.
export function safeCheckoutUrl(u?: string | null): string | null {
  if (!u) return null;
  const t = u.trim();
  if (/^https:\/\//i.test(t)) return t;
  return null;
}

// safeRedirect validates a post-login ?redirect= target (S24). Only
// single-leading-slash same-origin paths pass — "//evil", "https:…",
// backslashes, and control chars fall back to "/".
export function safeRedirect(target?: string | null, fallback = "/"): string {
  if (!target) return fallback;
  const t = target.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("\\")) return fallback;
  if (/[\r\n\t]/.test(t)) return fallback;
  if (/^\/[a-z]+:/i.test(t)) return fallback;
  return t || fallback;
}
