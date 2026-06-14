"use client";

import { useState, useEffect, useCallback } from "react";
import { BASE } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  subscriptionTier: string;
  onboarded: boolean;
}

const TOKEN_KEY = "truthseekers_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function useAuth() {
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

  const completeOnboarding = async (name: string): Promise<boolean> => {
    const t = getStoredToken();
    if (!t) return false;
    try {
      const res = await fetch(`${BASE}/auth/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${t}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return false;
      setUser((prev) => prev ? { ...prev, name, onboarded: true } : null);
      return true;
    } catch { return false; }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return { user, loading, token, login, completeOnboarding, logout };
}
