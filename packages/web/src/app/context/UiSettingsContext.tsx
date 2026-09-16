"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface UiSettings {
  // Layout Frame
  showWindowFrame: boolean;
  showTitleBar: boolean;
  showStatusBar: boolean;
  showLeftNav: boolean;
  showRightRail: boolean;

  // Article Document Tree
  showArticleHeader: boolean;
  showActionBar: boolean;
  showOverview: boolean;
  showDetailedFindings: boolean;
  showClaimsGrid: boolean;
  showClaimGraph: boolean;
  showEpistemicQuiz: boolean;
  showInlineClaimChips: boolean;
  showFooterPlate: boolean;

  // Right Rail Widgets
  showClaimInspector: boolean;
  showFigurePlate: boolean;
  showDidYouKnow: boolean;
}

export type UiPreset = "win7" | "barebones" | "reading" | "studio";

const DEFAULT_SETTINGS: UiSettings = {
  showWindowFrame: true,
  showTitleBar: true,
  showStatusBar: true,
  showLeftNav: true,
  showRightRail: true,

  showArticleHeader: true,
  showActionBar: true,
  showOverview: true,
  showDetailedFindings: true,
  showClaimsGrid: true,
  showClaimGraph: true,
  showEpistemicQuiz: true,
  showInlineClaimChips: true,
  showFooterPlate: true,

  showClaimInspector: true,
  showFigurePlate: true,
  showDidYouKnow: true,
};

const BAREBONES_PRESET: UiSettings = {
  showWindowFrame: false,
  showTitleBar: false,
  showStatusBar: false,
  showLeftNav: false,
  showRightRail: false,

  showArticleHeader: true,
  showActionBar: false,
  showOverview: true,
  showDetailedFindings: true,
  showClaimsGrid: false,
  showClaimGraph: false,
  showEpistemicQuiz: false,
  showInlineClaimChips: false,
  showFooterPlate: false,

  showClaimInspector: false,
  showFigurePlate: false,
  showDidYouKnow: false,
};

const READING_PRESET: UiSettings = {
  showWindowFrame: true,
  showTitleBar: true,
  showStatusBar: true,
  showLeftNav: false,
  showRightRail: false,

  showArticleHeader: true,
  showActionBar: true,
  showOverview: true,
  showDetailedFindings: true,
  showClaimsGrid: false,
  showClaimGraph: false,
  showEpistemicQuiz: false,
  showInlineClaimChips: true,
  showFooterPlate: true,

  showClaimInspector: true,
  showFigurePlate: true,
  showDidYouKnow: false,
};

const STUDIO_PRESET: UiSettings = {
  showWindowFrame: true,
  showTitleBar: true,
  showStatusBar: true,
  showLeftNav: true,
  showRightRail: true,

  showArticleHeader: true,
  showActionBar: true,
  showOverview: true,
  showDetailedFindings: true,
  showClaimsGrid: true,
  showClaimGraph: true,
  showEpistemicQuiz: true,
  showInlineClaimChips: true,
  showFooterPlate: true,

  showClaimInspector: true,
  showFigurePlate: true,
  showDidYouKnow: true,
};

interface UiSettingsContextType {
  settings: UiSettings;
  updateSetting: <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => void;
  toggleSetting: (key: keyof UiSettings) => void;
  applyPreset: (preset: UiPreset) => void;
  resetDefaults: () => void;
  isDrawerOpen: boolean;
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const STORAGE_KEY = "truthseekers_ui_settings";

const UiSettingsContext = createContext<UiSettingsContextType | null>(null);

export function UiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore JSON parse errors
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / private mode storage error
    }
  }, [settings, isLoaded]);

  // Global hotkey: Ctrl + Shift + U to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        setIsDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const updateSetting = useCallback(<K extends keyof UiSettings>(key: K, value: UiSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSetting = useCallback((key: keyof UiSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const applyPreset = useCallback((preset: UiPreset) => {
    switch (preset) {
      case "barebones":
        setSettings(BAREBONES_PRESET);
        break;
      case "reading":
        setSettings(READING_PRESET);
        break;
      case "studio":
        setSettings(STUDIO_PRESET);
        break;
      case "win7":
      default:
        setSettings(DEFAULT_SETTINGS);
        break;
    }
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), []);
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <UiSettingsContext.Provider
      value={{
        settings,
        updateSetting,
        toggleSetting,
        applyPreset,
        resetDefaults,
        isDrawerOpen,
        toggleDrawer,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </UiSettingsContext.Provider>
  );
}

export function useUiSettings() {
  const ctx = useContext(UiSettingsContext);
  if (!ctx) {
    throw new Error("useUiSettings must be used within a UiSettingsProvider");
  }
  return ctx;
}
