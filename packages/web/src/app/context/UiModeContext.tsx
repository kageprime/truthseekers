"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type WidthMode = "focus" | "expanded";

interface UiModeContextType {
  widthMode: WidthMode;
  setWidthMode: (mode: WidthMode) => void;
  toggleWidthMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const UiModeContext = createContext<UiModeContextType | undefined>(undefined);

export function UiModeProvider({ children }: { children: ReactNode }) {
  const [widthMode, setWidthModeState] = useState<WidthMode>("focus");
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("truthseekers_width_mode");
      if (savedWidth === "focus" || savedWidth === "expanded") {
        setWidthModeState(savedWidth);
      }
      const savedSidebar = localStorage.getItem("truthseekers_sidebar_open");
      if (savedSidebar !== null) {
        setSidebarOpenState(savedSidebar === "true");
      }
    } catch {
      // ignore storage errors
    }
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

  const setSidebarOpen = (open: boolean) => {
    setSidebarOpenState(open);
    try {
      localStorage.setItem("truthseekers_sidebar_open", String(open));
    } catch {}
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <UiModeContext.Provider
      value={{
        widthMode,
        setWidthMode,
        toggleWidthMode,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
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
