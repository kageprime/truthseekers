"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface FloatingChatValue {
  isOpen: boolean;
  panelMode: "docked" | "overlay";
  toggle: () => void;
  open: () => void;
  close: () => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

const FloatingChatContext = createContext<FloatingChatValue | null>(null);

const OVERLAY_ROUTES = ["/maps/"];
const HIDDEN_ROUTES = ["/login", "/onboarding", "/chat/"];
const STORAGE_KEY = "truthseekers_floating_chat";

function getStoredState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function FloatingChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Hydrate localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setIsOpen(getStoredState());
    setMounted(true);
  }, []);

  // Persist open state
  useEffect(() => {
    if (!mounted) return;
    try {
      if (isOpen) localStorage.setItem(STORAGE_KEY, "true");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [isOpen, mounted]);

  // Close on navigation to hidden routes
  useEffect(() => {
    if (mounted && HIDDEN_ROUTES.some((r) => pathname.startsWith(r))) {
      setIsOpen(false);
    }
  }, [pathname, mounted]);

  const isHidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
  const isOverlay = OVERLAY_ROUTES.some((r) => pathname.startsWith(r));

  const panelMode: "docked" | "overlay" = isOverlay ? "overlay" : "docked";

  const toggle = useCallback(() => {
    if (!isHidden) setIsOpen((o) => !o);
  }, [isHidden]);

  const open = useCallback(() => {
    if (!isHidden) setIsOpen(true);
  }, [isHidden]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <FloatingChatContext.Provider value={{ isOpen, panelMode, toggle, open, close, activeConversationId, setActiveConversationId }}>
      {children}
    </FloatingChatContext.Provider>
  );
}

export function useFloatingChat(): FloatingChatValue {
  const ctx = useContext(FloatingChatContext);
  if (!ctx) throw new Error("useFloatingChat must be used within FloatingChatProvider");
  return ctx;
}
