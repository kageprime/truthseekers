"use client";

import { type ReactNode } from "react";

/**
 * PageLayout — content frame for standard pages.
 *
 * The old version floated colored blur orbs (bg-blue-500/20 blur-[120px])
 * — a generic AI-startup backdrop that fought the encyclopedia identity.
 * Removed: the warm paper surface (with its faint grain in body::before)
 * now carries the atmosphere on its own.
 */
export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex flex-row flex-1 min-h-0 relative overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {children}
      </div>
    </div>
  );
}

interface PageLayoutProps {
  children: ReactNode;
}
