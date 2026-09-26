"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";

export type WidthMode = "focus" | "expanded";
export type TypeScale = "s" | "m" | "l";
// Reading-column alignment. "left" anchors the canvas to the sidebar edge
// (editorial/gutter-aligned); "center" floats it in the viewport. Defaults to
// left so content is never force-centered.
export type AlignMode = "left" | "center";

const OPEN_DELAY = 160;
const CLOSE_DELAY = 260;

interface UiModeContextType {
  widthMode: WidthMode;
  setWidthMode: (mode: WidthMode) => void;
  toggleWidthMode: () => void;
  alignMode: AlignMode;
  setAlignMode: (mode: AlignMode) => void;
  // Ready-made margin utility for page containers: "mr-auto" hangs the column
  // off the left edge, "mx-auto" centers it.
  alignClass: string;
  typeScale: TypeScale;
  setTypeScale: (s: TypeScale) => void;
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
  const [alignMode, setAlignModeState] = useState<AlignMode>("left");
  const [typeScale, setTypeScaleState] = useState<TypeScale>("m");
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("truthseekers_width_mode");
      if (savedWidth === "focus" || savedWidth === "expanded") {
        setWidthModeState(savedWidth);
      }
      const savedAlign = localStorage.getItem("truthseekers_align_mode");
      if (savedAlign === "left" || savedAlign === "center") {
        setAlignModeState(savedAlign);
      }
      const savedType = localStorage.getItem("truthseekers_type_scale");
      if (savedType === "s" || savedType === "m" || savedType === "l") {
        setTypeScaleState(savedType);
        document.documentElement.dataset.type = savedType;
      } else {
        document.documentElement.dataset.type = "m";
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

  const setAlignMode = (mode: AlignMode) => {
    setAlignModeState(mode);
    try {
      localStorage.setItem("truthseekers_align_mode", mode);
    } catch {}
  };

  // Nothing about the grid should force a centered column: pages append this
  // to their max-width container instead of hardcoding mx-auto.
  const alignClass = alignMode === "left" ? "mr-auto" : "mx-auto";

  // ponytail: rem knob only — full fluid-type scale if readers ask.
  const setTypeScale = (s: TypeScale) => {
    setTypeScaleState(s);
    try {
      localStorage.setItem("truthseekers_type_scale", s);
      document.documentElement.dataset.type = s;
    } catch {}
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
        alignMode,
        setAlignMode,
        alignClass,
        typeScale,
        setTypeScale,
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
