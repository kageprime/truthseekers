"use client";

import { useAuth as useAuthContext } from "../components/AuthProvider";
import { getStoredToken, storeToken, clearToken } from "../components/AuthProvider";

export { getStoredToken, storeToken, clearToken };

export function useAuth() {
  const ctx = useAuthContext();
  const t = getStoredToken();

  const completeOnboarding = async (name: string): Promise<boolean> => {
    if (!t) return false;
    try {
      const { BASE } = await import("@/lib/constants");
      const res = await fetch(`${BASE}/auth/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${t}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return false;
      ctx.refresh();
      return true;
    } catch { return false; }
  };

  return { ...ctx, completeOnboarding };
}
