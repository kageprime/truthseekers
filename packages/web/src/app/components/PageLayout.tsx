"use client";

import { useState, useCallback, useEffect, type FormEvent } from "react";
import SharedHeader from "./SharedHeader";
import Sidebar from "./Sidebar";

interface HeaderSearch {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClear?: () => void;
  placeholder?: string;
}

interface PageLayoutProps {
  children: React.ReactNode;
  footerText?: string;
  sidebar?: boolean;
  sidebarDefaultOpen?: boolean;
  sidebarDefaultCollapsed?: boolean;
  activeId?: string;
  noFooter?: boolean;
  noHeader?: boolean;
  headerSearch?: HeaderSearch;
}

export default function PageLayout({
  children,
  footerText = "The Living Encyclopedia · AI-powered knowledge base",
  sidebar = false,
  sidebarDefaultOpen = false,
  sidebarDefaultCollapsed = false,
  activeId,
  noFooter = false,
  noHeader = false,
  headerSearch,
}: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(sidebarDefaultOpen);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      {!noHeader && (
        <SharedHeader
          onToggleSidebar={sidebar ? toggleSidebar : undefined}
          sidebarOpen={sidebarOpen}
          search={headerSearch}
        />
      )}
      {noHeader && sidebar && !sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 right-4 z-50 btn-icon btn-secondary shadow-sm lg:!hidden"
          aria-label="Open sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <div className="flex flex-row flex-1 min-h-0 relative overflow-x-hidden">
        {/* Animated glowing orbs background (hidden on mobile) */}
        <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-20 mix-blend-screen dark:mix-blend-lighten">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-accent/20 blur-[150px] animate-float" style={{ animationDuration: '12s' }} />
          <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[40%] rounded-full bg-green-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
        </div>
        {sidebar && (
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            activeId={activeId}
            defaultCollapsed={sidebarDefaultCollapsed}
          />
        )}
        <div className="flex-1 flex flex-col min-w-0 min-h-0" id="main-content">
          {children}
        </div>
      </div>
      {!noFooter && (
        <footer className="border-t px-6 py-3" style={{ borderColor: "var(--border-light)", background: "var(--surface)" }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <img src="/logo-text.png" alt="Truthseekers" style={{ height: 16, width: "auto", objectFit: "contain" }} />
            <span className="text-xs" style={{ color: "var(--subtle)" }}>{footerText}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
