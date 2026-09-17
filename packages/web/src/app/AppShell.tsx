"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopNavigationBar from "./components/navigation/TopNavigationBar";
import DockedSidebar from "./components/navigation/DockedSidebar";
import FloatingChatWidget from "./components/FloatingChatWidget";
import { useFloatingChat } from "./FloatingChatContext";
import { useAuth } from "./hooks/useAuth";

const HIDDEN_ROUTES = ["/login", "/onboarding"];
const CHAT_ROUTES = ["/chat/"];
const PROTECTED_ROUTES = ["/admin", "/settings", "/onboarding", "/article/new", "/queue"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, toggle, close, isExpanded } = useFloatingChat();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    const gated = PROTECTED_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
    if (gated && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, pathname, router]);

  const isHidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
  const isChatRoute = CHAT_ROUTES.some((r) => pathname.startsWith(r));
  const showChat = isOpen && !isChatRoute && !isHidden;

  // Keyboard shortcut Cmd+/ to toggle assistant chat
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  if (isHidden) {
    return <div className="min-h-screen bg-surface text-ink">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink selection:bg-gold-bg selection:text-ink font-sans antialiased">
      {/* Sticky Top Navigation */}
      <TopNavigationBar />

      {/* Main App Workspace */}
      <div className="flex-1 flex w-full relative">
        {/* Collapsible Fixed Docked Sidebar */}
        <DockedSidebar />

        {/* Dynamic Center Reading Canvas */}
        <main
          id="main-content"
          className="flex-1 min-w-0 min-h-[calc(100vh-3.5rem)] flex flex-col"
        >
          {children}
        </main>

        {/* Floating Chat Assistant Drawer (on-demand) */}
        {showChat && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-xs"
              onClick={close}
            />
              <aside
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-surface-elevated border-l border-rule z-50 shadow-elev-3 flex flex-col animate-slide-in-right"
              aria-label="Veritas Assistant Drawer"
            >
              <div className="h-14 px-4 border-b border-rule flex items-center justify-between bg-surface">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-forest animate-pulse" />
                  <span className="font-bold text-sm text-ink">Veritas Co-Manager</span>
                </div>
                <button
                  onClick={close}
                  className="p-1 rounded-md text-muted hover:text-ink hover:bg-ink/5"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <FloatingChatWidget />
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}