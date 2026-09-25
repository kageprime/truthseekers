"use client";

// Single source of truth for the session JWT.
// Memory + localStorage + readable-cookie fallback so the session survives
// reloads and cross-origin setups where the HttpOnly cookie may be blocked.

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
  const stored =
    parseCookie(TOKEN_KEY) ??
    (() => {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    })();
  if (stored) {
    memoryToken = stored;
    return stored;
  }
  return null;
}

export function storeToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}
