"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import FloatingChatWidget from "./components/FloatingChatWidget";
import ExploreView from "./components/ExploreView";
import PressView from "./components/PressView";
import ViewSwitcher from "./components/ViewSwitcher";
import { useFloatingChat } from "./FloatingChatContext";
import { useArticleView } from "./ArticleViewContext";
import { useTheme } from "./components/ThemeProvider";

const HIDDEN_ROUTES = ["/login", "/onboarding"];
const OVERLAY_ROUTES = ["/maps/"];
const CHAT_ROUTES = ["/chat/"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOpen, toggle, close, isExpanded } = useFloatingChat();
  const { article, mode } = useArticleView();
  const { resolved, toggle: toggleTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isHidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
  const isOverlayRoute = OVERLAY_ROUTES.some((r) => pathname.startsWith(r));
  const isChatRoute = CHAT_ROUTES.some((r) => pathname.startsWith(r));
  const showChat = isOpen && !isChatRoute && !isHidden;
  const isOverlay = isMobile || isOverlayRoute;

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

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div
        className="flex-1 flex min-h-0 min-w-0"
        style={showChat && !isOverlay ? {
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          overflow: "hidden",
          transition: "grid-template-columns 0.35s cubic-bezier(0.23, 1, 0.32, 1)",
        } : { display: "flex", overflow: "auto" }}
      >
        <main
          className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col"
          id="main-content"
          style={{ containerType: "inline-size", containerName: "page" }}
        >
          {children}
        </main>

        {showChat && !isOverlay && (
          <aside className="relative min-h-0 h-full overflow-hidden border-l border-border">
            {/* Close button inside the aside, desktop only */}
            <button
              onClick={close}
              className="hidden lg:flex absolute -top-1 -left-5 z-10 w-8 h-8 rounded-full items-center justify-center shadow-md bg-surface border border-border text-subtle hover:text-ink transition-colors"
              aria-label="Close chat"
            >
              ✕
            </button>
            <FloatingChatWidget />
          </aside>
        )}
      </div>

      {!isHidden && !isChatRoute && (
        <footer className="border-t border-border shrink-0 h-9 leading-9 bg-surface">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-[11px] font-serif text-muted">Truthseekers — The Living Encyclopedia</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="btn-ghost p-0.5"
                aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {resolved === "dark" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
              <span className="text-[10px] font-serif text-subtle">&copy; {new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile/Overlay: bottom-sheet backdrop + panel */}
      {showChat && isOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={close} />
          <div className="relative pointer-events-auto rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden bg-surface border border-border">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-subtle" />
            </div>
            <FloatingChatWidget />
          </div>
        </div>
      )}

      {/* Expanded full-screen overlay */}
      {isExpanded && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center bg-surface">
          <div className="w-full max-w-4xl h-full flex flex-col">
            <FloatingChatWidget />
          </div>
        </div>
      )}

      {/* Explore overlay */}
      <ExploreView />

      {/* Press overlay */}
      <PressView />

      {/* Floating ViewSwitcher for stream mode */}
      {article && mode === "stream" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] shadow-lg rounded-full p-0.5 bg-surface-elevated border border-rule">
          <ViewSwitcher />
        </div>
      )}

      {/* Floating toggle button */}
      {!isOpen && !isHidden && !isChatRoute && (
        <button
          onClick={toggle}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 max-md:w-12 max-md:h-12 max-md:bottom-4 max-md:right-4 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 bg-accent text-white border-none cursor-pointer"
          aria-label="Open chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}