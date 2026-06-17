"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Sidebar from "../components/Sidebar";
import ChatTour from "../components/ChatTour";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (searchParams.get("tour") === "true") {
      setShowTour(true);
      // Clean URL without full page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : undefined;

  return (
    <>
      {showTour && <ChatTour onComplete={() => setShowTour(false)} />}
      <div className="h-screen overflow-hidden flex flex-col">
      {/* Mobile hamburger when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
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
        {/* Wave background */}
        <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04] wave-1">
            <svg viewBox="0 0 1800 400" preserveAspectRatio="none" className="w-[300%] h-full">
              <path d="M0,270 C200,150 500,380 800,270 C1100,150 1400,380 1800,270 L1800,400 L0,400 Z" fill="var(--blue)" />
            </svg>
          </div>
          <div className="absolute inset-0 opacity-[0.03] wave-2">
            <svg viewBox="0 0 1800 400" preserveAspectRatio="none" className="w-[300%] h-full">
              <path d="M0,290 C200,200 500,360 800,290 C1100,200 1400,360 1800,290 L1800,400 L0,400 Z" fill="var(--blue)" />
            </svg>
          </div>
          <div className="absolute inset-0 opacity-[0.025] wave-3">
            <svg viewBox="0 0 1800 400" preserveAspectRatio="none" className="w-[300%] h-full">
              <path d="M0,310 C200,250 500,350 800,310 C1100,250 1400,350 1800,310 L1800,400 L0,400 Z" fill="var(--accent)" />
            </svg>
          </div>
        </div>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeId={activeId}
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-0" id="main-content">
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
