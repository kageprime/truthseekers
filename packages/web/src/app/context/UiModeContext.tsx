"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";

export type WidthMode = "focus" | "expanded";

const OPEN_DELAY = 160;
const CLOSE_DELAY = 260;

interface UiModeContextType {
  widthMode: WidthMode;
  setWidthMode: (mode: WidthMode) => void;
  toggleWidthMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  // Hover-intent drawer: hovering the nav button floats the sidebar in as an
  // overlay; leaving both closes it. Click/focus toggles for touch + keyboard.
  hoverSidebarIn: () => void;
  hoverSidebarOut: () => void;
  cancelSidebarClose: () => void;
}

const UiModeContext = createContext<UiModeContextType | undefined>(undefined);

export function UiModeProvider({ children }: { children: ReactNode }) {
  const [widthMode, setWidthModeState] = useState<WidthMode>("focus");
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("truthseekers_width_mode");
      if (savedWidth === "focus" || savedWidth === "expanded") {
        setWidthModeState(savedWidth);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const setWidthMode = (mode: WidthMode) => {
    setWidthModeState(mode);
    try {
      localStorage.setItem("truthseekers_width_mode", mode);
    } catch {}
  };

  const toggleWidthMode = () => {
    setWidthMode(widthMode === "focus" ? "expanded" : "focus");
  };

  const clearTimers = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  const setSidebarOpen = useCallback((open: boolean) => {
    clearTimers();
    setSidebarOpenState(open);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const cancelSidebarClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
  }, []);

  const hoverSidebarIn = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (openTimer.current) return;
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      setSidebarOpenState(true);
    }, OPEN_DELAY);
  }, []);

  const hoverSidebarOut = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) return;
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setSidebarOpenState(false);
    }, CLOSE_DELAY);
  }, []);

  return (
    <UiModeContext.Provider
      value={{
        widthMode,
        setWidthMode,
        toggleWidthMode,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        hoverSidebarIn,
        hoverSidebarOut,
        cancelSidebarClose,
      }}
    >
      {children}
    </UiModeContext.Provider>
  );
}

export function useUiMode() {
  const context = useContext(UiModeContext);
  if (!context) {
    throw new Error("useUiMode must be used within a UiModeProvider");
  }
  return context;
}
