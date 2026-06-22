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
  const token = getStoredToken();

  const fetchMe = useCallback(async (): Promise<User | null> => {
    const t = getStoredToken();
    if (!t) return null;
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
    fetchMe().then((u) => { setUser(u); setLoading(false); });
  }, [fetchMe]);

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
      setUser(data.user);
      return { user: data.user, token: data.token };
    } catch {
      return { error: "Network error" };
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const refresh = () => {
    setLoading(true);
    fetchMe().then((u) => { setUser(u); setLoading(false); });
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
