"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchMe, type AuthUser } from "@/lib/api";

interface User extends AuthUser {
  role: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  token: string | null;
  tokenPayload: ReturnType<typeof import("@/lib/api").decodeJwt>;
  login: (email: string) => Promise<{ user: User; token: string } | { error: string }>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Re-exported so existing importers (login page, useAuth hook) keep working;
// the implementation lives in @/lib/token, shared with api.authHeaders.
export { getStoredToken, storeToken, clearToken } from "@/lib/token";
import { getStoredToken, storeToken, clearToken } from "@/lib/token";

const MOCK_KEY = "truthseekers_mock";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Sync token state from storage (catches changes across navigations)
  useEffect(() => {
    setToken(getStoredToken());
    const interval = setInterval(() => {
      const t = getStoredToken();
      setToken((prev) => (prev !== t ? t : prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const [tokenPayload, setTokenPayload] = useState<ReturnType<typeof import("@/lib/api").decodeJwt>>(null);
  useEffect(() => {
    // Dynamic import avoids a circular dep risk during SSR; the module is tiny.
    import("@/lib/api").then(({ decodeJwt }) => {
      setTokenPayload(token ? decodeJwt(token) : null);
    });
  }, [token]);

  const MOCK_USER: User = {
    id: "user-mock-1", email: "researcher@example.com", name: "Dr. Alex Researcher",
    avatar: "", subscriptionTier: "pro", onboarded: true, role: "admin",
  };

  const fetchMeWithRole = useCallback(async (t: string | null): Promise<User | null> => {
    if (!t) return null;
    if (t === MOCK_KEY) return MOCK_USER;
    const u = await fetchMe(t);
    if (!u) { clearToken(); return null; }
    // Decode role from JWT payload — the server includes it in the token.
    const { decodeJwt } = await import("@/lib/api");
    const payload = decodeJwt(t);
    return { ...u, role: u.role ?? payload?.role ?? "member" };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (!token) {
          // Cookie-only session (S7): no JS token (e.g. after reload) — the
          // browser still sends the HttpOnly cookie via credentials:include.
          const { fetchMeCookie } = await import("@/lib/api");
          const u = await fetchMeCookie();
          if (!cancelled) {
            setUser(u ? { ...u, role: u.role ?? "member" } : null);
            setLoading(false);
          }
          return;
        }
        const u = await fetchMeWithRole(token);
        if (!cancelled) { setUser(u); setLoading(false); }
      } catch {
        // Transport/server failure (never a rejection — those return null
        // above): keep the existing session and user visible instead of
        // logging out on a blip. The next navigation or token sync retries.
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, fetchMeWithRole]);

  const login = async (email: string): Promise<{ user: User; token: string } | { error: string }> => {
    try {
      const { loginEmail } = await import("@/lib/api");
      const data = await loginEmail(email);
      if (data.error || !data.token || !data.user) {
        return { error: data.error || "Login failed" };
      }
      storeToken(data.token);
      setToken(data.token);
      return { user: { ...data.user, role: data.user.role ?? "member" }, token: data.token };
    } catch {
      return { error: "Network error" };
    }
  };

  const logout = () => {
    import("@/lib/api").then(({ logoutServer }) => logoutServer()).catch(() => {});
    clearToken();
    setToken(null);
    setUser(null);
  };

  const refresh = () => {
    setToken(getStoredToken());
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, tokenPayload, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
