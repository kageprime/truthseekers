"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * ReadingDeskContext — the right-rail slot. Pages push a panel (claim
 * details, tools) here and the ReadingDesk renders it in the existing
 * right rail instead of stacking another overlay beside it. Cleared on
 * unmount/route change by the pushing effect.
 */
interface ReadingDeskValue {
  panel: ReactNode | null;
  setPanel: (node: ReactNode | null) => void;
  /** True while a panel occupies the desk (used for width + aria). */
  hasPanel: boolean;
}

const ReadingDeskContext = createContext<ReadingDeskValue | null>(null);

export function ReadingDeskProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<ReactNode | null>(null);
  return (
    <ReadingDeskContext.Provider value={{ panel, setPanel, hasPanel: panel !== null }}>
      {children}
    </ReadingDeskContext.Provider>
  );
}

export function useReadingDesk(): ReadingDeskValue {
  const ctx = useContext(ReadingDeskContext);
  if (!ctx) throw new Error("useReadingDesk must be used within ReadingDeskProvider");
  return ctx;
}