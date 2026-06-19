"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SharedHeader from "./components/SharedHeader";
import FloatingChatWidget from "./components/FloatingChatWidget";
import { useFloatingChat } from "./FloatingChatContext";
import { useHeaderSearch } from "./HeaderSearchContext";

const HIDDEN_ROUTES = ["/login", "/onboarding"];
const OVERLAY_ROUTES = ["/maps/"];
const CHAT_ROUTES = ["/chat/"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOpen, toggle, close, isExpanded } = useFloatingChat();
  const { search } = useHeaderSearch();
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

  // Keyboard shortcut: Cmd/Ctrl + /
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
      {!isHidden && <SharedHeader search={search ?? undefined} />}

      <div className="flex-1 flex min-h-0 min-w-0"
        style={showChat && !isOverlay ? {
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          overflow: "hidden",
          transition: "grid-template-columns 0.35s cubic-bezier(0.23, 1, 0.32, 1)",
        } : { display: "flex", overflow: "auto" }}>
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col" id="main-content"
          style={{ containerType: "inline-size", containerName: "page" }}>
          {isHidden ? children : (
            <div className="max-w-[1400px] mx-auto w-full flex-1 flex flex-col min-h-0">
              {children}
            </div>
          )}
        </main>

        {showChat && !isOverlay && (
          <aside className="min-h-0 h-full overflow-hidden" style={{ borderLeft: "1px solid var(--border)" }}>
            <FloatingChatWidget />
          </aside>
        )}
      </div>

      {!isHidden && !isChatRoute && (
        <footer className="border-t shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface)", height: 36, lineHeight: "36px" }}>
          <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-[11px] font-serif" style={{ color: "var(--muted)" }}>Truthseekers — The Living Encyclopedia</span>
            </div>
            <span className="text-[10px] font-serif" style={{ color: "var(--subtle)" }}>&copy; {new Date().getFullYear()}</span>
          </div>
        </footer>
      )}

      {/* Desktop dock close button — shown when docked and open */}
      {showChat && !isOverlay && (
        <button
          onClick={close}
          className="fixed top-20 right-[410px] z-50 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--subtle)" }}
          aria-label="Close chat"
        >
          ✕
        </button>
      )}

      {/* Mobile/Overlay: bottom-sheet backdrop + panel */}
      {showChat && isOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={close} />
          <div className="relative pointer-events-auto bg-[var(--surface)] rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden"
            style={{ border: "1px solid var(--border)" }}>
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--subtle)" }} />
            </div>
            <FloatingChatWidget />
          </div>
        </div>
      )}

      {/* Expanded full-screen overlay */}
      {isExpanded && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center" style={{ background: "var(--surface)" }}>
          <div className="w-full max-w-4xl h-full flex flex-col">
            <FloatingChatWidget />
          </div>
        </div>
      )}

      {/* Floating toggle button — hidden on mobile when chat is open (already visible as overlay) */}
      {!isOpen && !isHidden && !isChatRoute && (
        <button
          onClick={toggle}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 max-md:w-12 max-md:h-12 max-md:bottom-4 max-md:right-4 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
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
