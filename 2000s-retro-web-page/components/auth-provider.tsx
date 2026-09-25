"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchMe, fetchMeCookie, logoutServer } from "@/lib/api";
import { clearToken, getStoredToken, storeToken } from "@/lib/token";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // ponytail: retry once on 401 — a single rejection can be a blip
  // (restart, clock skew); only a confirmed second rejection wipes the token.
  const resolveSession = useCallback(async (signal: AbortSignal): Promise<AuthUser | null> => {
    const t = getStoredToken();
    if (t) {
      const u = await fetchMe().catch(() => null);
      if (u) return u;
      await new Promise((r) => setTimeout(r, 750));
      if (signal.aborted) return null;
      const retry = await fetchMe().catch(() => null);
      if (retry) return retry;
      clearToken();
      return null;
    }
    // Cookie-only session (e.g. after reload with no JS token).
    return fetchMeCookie().catch(() => null);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    resolveSession(ctrl.signal)
      .then((u) => {
        if (!ctrl.signal.aborted) setUser(u);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [nonce, resolveSession]);

  // Revalidate on focus so long-lived tabs pick up server-side token rotation.
  useEffect(() => {
    let last = 0;
    const revalidate = () => {
      if (Date.now() - last < 5 * 60 * 1000) return;
      if (!getStoredToken() && !user) return;
      last = Date.now();
      setNonce((n) => n + 1);
    };
    const id = setInterval(revalidate, 15 * 60 * 1000);
    window.addEventListener("focus", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((token: string, u: AuthUser) => {
    storeToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    logoutServer().catch(() => {});
    clearToken();
    setUser(null);
  }, []);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const valueRef = useRef<AuthContextValue | null>(null);
  valueRef.current = { user, loading, login, logout, refresh };

  return <AuthContext.Provider value={valueRef.current}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
