"use client";

import { useEffect, useState } from "react";

export type RetroStyleMode = "hybrid" | "win98" | "vintage";

const THEME_KEY = "truthseekers_retro_style";

export function getRetroStyleMode(): RetroStyleMode {
  if (typeof window === "undefined") return "hybrid";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "win98" || saved === "vintage" || saved === "hybrid") return saved;
  } catch {}
  return "hybrid";
}

export function setRetroStyleMode(mode: RetroStyleMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
    window.dispatchEvent(new CustomEvent("retro-theme-change", { detail: mode }));
  } catch {}
}

export function useRetroTheme(): [RetroStyleMode, (mode: RetroStyleMode) => void] {
  const [theme, setTheme] = useState<RetroStyleMode>("hybrid");

  useEffect(() => {
    setTheme(getRetroStyleMode());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "win98" || detail === "vintage" || detail === "hybrid") {
        setTheme(detail);
      }
    };
    window.addEventListener("retro-theme-change", handler);
    return () => window.removeEventListener("retro-theme-change", handler);
  }, []);

  const update = (mode: RetroStyleMode) => {
    setTheme(mode);
    setRetroStyleMode(mode);
  };

  return [theme, update];
}
