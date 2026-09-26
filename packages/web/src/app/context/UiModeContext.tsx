"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export type WidthMode = "focus" | "expanded";
export type TypeScale = "s" | "m" | "l";
// Reading-column alignment. "left" anchors the canvas to the sidebar edge
// (editorial/gutter-aligned); "center" floats it in the viewport. Defaults to
// left so content is never force-centered.
export type AlignMode = "left" | "center";
export type ContainerVariant = "narrow" | "prose" | "standard" | "wide";

interface UiModeContextType {
  widthMode: WidthMode;
  setWidthMode: (mode: WidthMode) => void;
  toggleWidthMode: () => void;
  alignMode: AlignMode;
  setAlignMode: (mode: AlignMode) => void;
  // Ready-made margin utility for page containers: "mr-auto" hangs the column
  // off the left edge, "mx-auto" centers it.
  alignClass: string;
  containerClass: (variant?: ContainerVariant) => string;
  typeScale: TypeScale;
  setTypeScale: (s: TypeScale) => void;
  // Mobile navigation drawer (<lg only — the header nav owns lg+).
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const UiModeContext = createContext<UiModeContextType | undefined>(undefined);

export function UiModeProvider({ children }: { children: ReactNode }) {
  const [widthMode, setWidthModeState] = useState<WidthMode>("expanded");
  const [alignMode, setAlignModeState] = useState<AlignMode>("center");
  const [typeScale, setTypeScaleState] = useState<TypeScale>("m");
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(false);

  useEffect(() => {
    try {
      // ponytail: v2 defaults are centered+expanded — drop legacy pins once.
      if (!localStorage.getItem("truthseekers_layout_v2")) {
        localStorage.removeItem("truthseekers_align_mode");
        localStorage.removeItem("truthseekers_width_mode");
        localStorage.setItem("truthseekers_layout_v2", "1");
      }
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

  // ponytail: one helper replaces 11 ternaries — alignment + measure.
  // xl caps reserve 12rem rail + 2rem gap so prose never squeezes at 1280-1440px.
  const containerClass = useCallback((variant: ContainerVariant = "standard"): string => {
    const align = alignMode === "left" ? "mr-auto" : "mx-auto";
    const wide = widthMode === "expanded";
    switch (variant) {
      case "narrow": return `${align} ${wide ? "max-w-3xl" : "max-w-xl"}`;
      case "prose": return wide
        ? `${align} max-w-5xl xl:max-w-[78rem] 2xl:max-w-[84rem]`
        : `${align} max-w-3xl xl:max-w-[64rem]`;
      case "wide": return `${align} ${wide ? "max-w-7xl" : "max-w-5xl"}`;
      default: return `${align} ${wide ? "max-w-6xl" : "max-w-4xl"}`;
    }
  }, [alignMode, widthMode]);

  // ponytail: rem knob only — full fluid-type scale if readers ask.
  const setTypeScale = (s: TypeScale) => {
    setTypeScaleState(s);
    try {
      localStorage.setItem("truthseekers_type_scale", s);
      document.documentElement.dataset.type = s;
    } catch {}
  };

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Close the mobile drawer whenever the route changes — the new page is the
  // content, the drawer is not.
  const pathname = usePathname();
  useEffect(() => {
    setSidebarOpenState(false);
  }, [pathname]);

  return (
    <UiModeContext.Provider
      value={{
        widthMode,
        setWidthMode,
        toggleWidthMode,
        alignMode,
        setAlignMode,
        alignClass,
        containerClass,
        typeScale,
        setTypeScale,
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
