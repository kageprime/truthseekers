"use client";

import { useState, useCallback } from "react";
import SharedHeader from "./SharedHeader";
import Sidebar from "./Sidebar";

export const DEFAULT_NAV_LINKS = [
  { label: "Queue", href: "/queue" },
];

interface PageLayoutProps {
  children: React.ReactNode;
  navLinks?: Array<{ label: string; href: string }>;
  footerText?: string;
  sidebar?: boolean;
  sidebarDefaultOpen?: boolean;
  activeId?: string;
  noFooter?: boolean;
  noHeader?: boolean;
}

export default function PageLayout({
  children,
  navLinks = DEFAULT_NAV_LINKS,
  footerText = "The Living Encyclopedia · AI-powered knowledge base",
  sidebar = false,
  sidebarDefaultOpen = false,
  activeId,
  noFooter = false,
  noHeader = false,
}: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(sidebarDefaultOpen);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: "var(--warm)" }}>
      {!noHeader && (
        <SharedHeader
          links={navLinks}
          onToggleSidebar={sidebar ? toggleSidebar : undefined}
          sidebarOpen={sidebarOpen}
        />
      )}
      {noHeader && sidebar && !sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center border-2 border-black shadow-[2px_2px_0_#1c1917] bg-white text-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#1c1917] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1c1917]"
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}
      <div className="flex flex-row flex-1 min-h-0 relative overflow-x-hidden">
        {/* Wave background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.07] wave-1">
            <svg viewBox="0 0 1800 400" preserveAspectRatio="none" className="w-[300%] h-full">
              <path d="M0,270 C200,150 500,380 800,270 C1100,150 1400,380 1800,270 L1800,400 L0,400 Z" fill="var(--blue)" />
            </svg>
          </div>
          <div className="absolute inset-0 opacity-[0.05] wave-2">
            <svg viewBox="0 0 1800 400" preserveAspectRatio="none" className="w-[300%] h-full">
              <path d="M0,290 C200,200 500,360 800,290 C1100,200 1400,360 1800,290 L1800,400 L0,400 Z" fill="var(--blue)" />
            </svg>
          </div>
          <div className="absolute inset-0 opacity-[0.04] wave-3">
            <svg viewBox="0 0 1800 400" preserveAspectRatio="none" className="w-[300%] h-full">
              <path d="M0,310 C200,250 500,350 800,310 C1100,250 1400,350 1800,310 L1800,400 L0,400 Z" fill="var(--orange)" />
            </svg>
          </div>
        </div>
        {sidebar && (
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            activeId={activeId}
          />
        )}
        <div className="flex-1 flex flex-col min-w-0 min-h-0" id="main-content">
          {children}
        </div>
      </div>
      {!noFooter && (
        <footer className="border-t-2 border-black px-6 py-4" style={{ background: "var(--warm)" }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="pixel text-[8px]" style={{ color: "var(--ink)" }}>◆ Truthseekers</span>
            <span className="pixel text-[7px]" style={{ color: "var(--subtle)" }}>{footerText}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
