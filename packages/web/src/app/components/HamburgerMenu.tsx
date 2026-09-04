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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="btn-icon btn-ghost"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <div className="hamburger-morph" data-open={open}>
          <span /><span /><span />
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 sm:hidden" style={{ zIndex: "var(--z-modal, 9998)" }}>
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in srgb, var(--ink) 40%, transparent)",
              backdropFilter: "blur(24px) saturate(1.4)",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
              animation: "fade-in 300ms cubic-bezier(0.32, 0.72, 0, 1) both",
            }}
          />
          <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full w-[85vw] max-w-[340px] flex flex-col"
            style={{
              background: "var(--glass)",
              backdropFilter: "blur(40px) saturate(1.5)",
              WebkitBackdropFilter: "blur(40px) saturate(1.5)",
              borderLeft: "1px solid var(--glass-border)",
              boxShadow: "-24px 0 60px -12px rgba(26,22,18,0.25)",
              animation: "mask-panel-in 600ms cubic-bezier(0.32, 0.72, 0, 1) both",
            }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-light)" }}>
              <span className="font-display font-bold text-sm" style={{ letterSpacing: "-0.01em" }}>Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="btn-icon btn-ghost"
                aria-label="Close menu"
              >
                <div className="hamburger-morph" data-open={true}>
                  <span /><span /><span />
                </div>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-5 space-y-1" onClick={() => setOpen(false)}>
              {Array.isArray(children)
                ? children.map((child, i) => (
                    <div key={i} className="mask-link-in">{child}</div>
                  ))
                : <div className="mask-link-in">{children}</div>}
            </nav>
            <div className="px-5 py-4 text-xs text-center" style={{ borderTop: "1px solid var(--border-light)", color: "var(--subtle)" }}>
              <img src="/logo-text.png" alt="Truthseekers" style={{ height: 14, width: "auto", objectFit: "contain", opacity: 0.5, margin: "0 auto" }} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mask-panel-in {
          from { transform: translateX(20px); opacity: 0; filter: blur(8px); }
          to   { transform: translateX(0); opacity: 1; filter: blur(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}
