"use client";

import { useState, useRef, useEffect } from "react";

export default function HamburgerMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function clickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-icon btn-ghost"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/30" />
          <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full w-[85vw] max-w-[320px] glass-lg flex flex-col"
            style={{ animation: "slideIn 0.2s ease-out" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-light)" }}>
              <span className="font-semibold text-sm">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="btn-icon btn-ghost"
                aria-label="Close menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1" onClick={() => setOpen(false)}>
              {children}
            </div>
            <div className="px-5 py-3 border-t text-xs text-center" style={{ borderColor: "var(--border-light)", color: "var(--subtle)" }}>
              Truthseekers
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
