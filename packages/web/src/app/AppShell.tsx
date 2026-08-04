"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import FloatingChatWidget from "./components/FloatingChatWidget";
import ExploreView from "./components/ExploreView";
import PressView from "./components/PressView";
import GraphView from "./components/GraphView";
import ViewSwitcher from "./components/ViewSwitcher";
import FloatIslandNav from "./components/FloatIslandNav";
import { useFloatingChat } from "./FloatingChatContext";
import { useArticleView } from "./ArticleViewContext";
import { useAuth } from "./hooks/useAuth";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";


const HIDDEN_ROUTES = ["/login", "/onboarding"];
const OVERLAY_ROUTES = ["/maps/"];
const CHAT_ROUTES = ["/chat/"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, toggle, close, isExpanded } = useFloatingChat();
  const { user, logout } = useAuth();
  const { article, mode } = useArticleView();

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
    <div className="h-dvh overflow-hidden flex flex-col">
      {!isOverlayRoute && !isHidden && <FloatIslandNav />}
      <div className="flex-1 flex min-h-0 min-w-0 relative overflow-hidden">
        <main
          className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col"
          id="main-content"
          style={{ 
            containerType: "inline-size", 
            containerName: "page",
          }}
        >
          {children}
        </main>

        {showChat && !isOverlay && (
          <>
            <div className="fixed inset-0 bg-black/20 lg:hidden" onClick={close} style={{ zIndex: "var(--z-chat-backdrop)" }} />
            <aside className="fixed right-0 top-0 bottom-0 w-[400px] overflow-hidden border-l border-border bg-surface shadow-xl animate-slide-in-right" style={{ zIndex: "var(--z-chat-panel)" }}>
              <FloatingChatWidget />
            </aside>
          </>
        )}
      </div>

      {/* Mobile/Overlay: bottom-sheet backdrop + panel */}
      {showChat && isOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <div className="absolute inset-0 bg-black/30 pointer-events-auto animate-appear-blur" onClick={close} />
          <div className="relative pointer-events-auto rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden bg-surface border border-border chat-shell chat-message-enter">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 rounded-full bg-subtle/50" />
            </div>
            <FloatingChatWidget />
          </div>
        </div>
      )}

      {/* Expanded full-screen overlay */}
      {isExpanded && (
            <div className="fixed inset-0 flex flex-col items-center bg-surface glass-lg animate-appear-blur" style={{ zIndex: "var(--z-overlay)" }}>
          <div className="w-full max-w-4xl h-full flex flex-col chat-message-enter chat-shell my-4">
            <FloatingChatWidget />
          </div>
        </div>
      )}

      {/* Explore overlay */}
      <ExploreView />

      {/* Press overlay */}
      <PressView />

      {/* Graph overlay */}
      <GraphView />

      {/* Floating ViewSwitcher for stream mode — clear mobile nav */}
      {article && mode === "stream" && (
        <div className="fixed md:bottom-6 bottom-24 left-1/2 -translate-x-1/2 shadow-lg rounded-full p-0.5 bg-surface-elevated border border-rule animate-appear-up" style={{ zIndex: "var(--z-view-switcher)" }}>
          <ViewSwitcher />
        </div>
      )}

      {/* Floating toggle button — hidden on mobile (bottom dock provides nav) */}
      {!isOpen && !isHidden && !isChatRoute && (
        <button
          onClick={toggle}
          className={`fixed bottom-6 right-6 fab-chat ${isMobile ? "hidden md:flex" : ""}`} style={{ zIndex: "var(--z-chat-toggle)" }}
          aria-label="Open chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Mock mode controls */}
      {IS_MOCK && user && (
        <div className="fixed bottom-2 left-2 z-50 flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] border"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-forest" />
          <span style={{ color: "var(--muted)" }}>Mock: {user.name}</span>
          <button
            onClick={() => router.push("/settings")}
            className="font-medium hover:underline cursor-pointer"
            style={{ color: "var(--gold)", background: "none", border: "none", padding: 0 }}
          >
            Settings
          </button>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="font-medium hover:underline cursor-pointer"
            style={{ color: "var(--gold)", background: "none", border: "none", padding: 0 }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}