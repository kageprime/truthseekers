"use client";

import { useAuth as useAuthContext } from "../components/AuthProvider";
import { getStoredToken, storeToken, clearToken } from "../components/AuthProvider";
import { useOnboard } from "./useApi";

export { getStoredToken, storeToken, clearToken };

export function useAuth() {
  const ctx = useAuthContext();
  const { mutate: onboardMutate } = useOnboard();

  const completeOnboarding = async (name: string): Promise<boolean> => {
    const t = getStoredToken();
    if (!t) return false;
    const ok = await onboardMutate({ token: t, name });
    if (ok) ctx.refresh();
    return !!ok;
  };

  return { ...ctx, completeOnboarding };
}
