"use client";

// Single source of truth for the session JWT (S7).
// Memory-only: new logins are never written to localStorage or a
// JS-readable cookie. The server also sets an HttpOnly cookie which the
// browser sends via credentials:include. Module scope survives navigations
// (client component) but not reloads; reloads restore via fetchMeCookie().

const TOKEN_KEY = "truthseekers_token";

let memoryToken: string | null = null;

function parseCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return memoryToken;
  if (memoryToken) return memoryToken;
  // One-way legacy migration: a readable cookie/localStorage entry predates
  // HttpOnly cookies. Promote to memory and delete the persistent copies.
  const legacy = parseCookie(TOKEN_KEY) ?? (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  if (legacy) {
    memoryToken = legacy;
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    return legacy;
  }
  return null;
}

export function storeToken(token: string): void {
  // ponytail: memory only — never localStorage/document.cookie (S7).
  memoryToken = token;
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function clearToken(): void {
  memoryToken = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  // NOTE: do NOT delete document.cookie here — an expired non-HttpOnly
  // cookie would overwrite the server's HttpOnly session cookie key.
  // Server-side logout (/auth/logout) expires it instead; see logout().
}
