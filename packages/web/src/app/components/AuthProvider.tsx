"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { BASE } from "@/lib/constants";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  subscriptionTier: string;
  onboarded: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: (email: string) => Promise<{ user: User; token: string } | { error: string }>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "truthseekers_token";
const MOCK_KEY = "truthseekers_mock";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function parseCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function migrateToken(): void {
  if (typeof window === "undefined") return;
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy && !parseCookie(TOKEN_KEY)) {
    setCookie(TOKEN_KEY, legacy, TOKEN_MAX_AGE);
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  migrateToken();
  return parseCookie(TOKEN_KEY);
}

export function storeToken(token: string): void {
  setCookie(TOKEN_KEY, token, TOKEN_MAX_AGE);
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearToken(): void {
  deleteCookie(TOKEN_KEY);
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

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

  const MOCK_USER: User = {
    id: "user-mock-1", email: "researcher@example.com", name: "Dr. Alex Researcher",
    avatar: "", subscriptionTier: "pro", onboarded: true,
  };

  const fetchMe = useCallback(async (t: string | null): Promise<User | null> => {
    if (!t) return null;
    if (t === MOCK_KEY) return MOCK_USER;
    try {
      const res = await fetch(`${BASE}/auth/me`, {
        headers: { authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      if (!res.ok) { clearToken(); return null; }
      const data = await res.json();
      return data.user;
    } catch { return null; }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMe(token).then((u) => { setUser(u); setLoading(false); });
  }, [token, fetchMe]);

  const login = async (email: string): Promise<{ user: User; token: string } | { error: string }> => {
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Login failed" };
      storeToken(data.token);
      setToken(data.token);
      return { user: data.user, token: data.token };
    } catch {
      return { error: "Network error" };
    }
  };

  const logout = () => {
    clearToken();
    setToken(null);
    setUser(null);
  };

  const refresh = () => {
    setToken(getStoredToken());
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
