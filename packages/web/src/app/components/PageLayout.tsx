"use client";

import { useState } from "react";
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
}

export default function PageLayout({
  children,
  navLinks = DEFAULT_NAV_LINKS,
  footerText = "The Living Encyclopedia · AI-powered knowledge base",
  sidebar = false,
  sidebarDefaultOpen = false,
  activeId,
  noFooter = false,
}: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(sidebarDefaultOpen);

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: "var(--warm)" }}>
      <SharedHeader
        links={navLinks}
        onToggleSidebar={sidebar ? () => setSidebarOpen((o) => !o) : undefined}
        sidebarOpen={sidebarOpen}
      />
      <div className="flex flex-row flex-1 min-h-0 relative">
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {children}
        </div>
      </div>
      {!noFooter && (
        <footer className="border-t px-6 py-6" style={{ borderColor: "#dadce0", background: "white" }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-sm gap-1" style={{ color: "#5f6368" }}>
            <span className="font-medium" style={{ color: "#1a1a1a" }}>Truthseekers</span>
            <span className="text-xs">{footerText}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
