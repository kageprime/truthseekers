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
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden w-11 h-11 flex items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0_#1c1917]"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" />
          <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full w-[85vw] max-w-[320px] bg-white shadow-xl border-l-2 border-black flex flex-col"
            style={{ animation: "slideIn 0.2s ease-out" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
              <span className="font-bold text-sm">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="w-11 h-11 flex items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0_#1c1917] text-sm"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1" onClick={() => setOpen(false)}>
              {children}
            </div>
            <div className="px-5 py-3 border-t-2 border-black text-[10px] text-[#888] text-center">
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
