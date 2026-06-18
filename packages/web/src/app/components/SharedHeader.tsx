"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import QueueIndicator from "./QueueIndicator";
import { useTheme } from "./ThemeProvider";
import { IconSearch, IconX } from "./Icons";
import { useAuth } from "../hooks/useAuth";

interface HeaderSearch {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClear?: () => void;
  placeholder?: string;
}

interface HeaderProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  search?: HeaderSearch;
}

const NAV_LINKS = [
  { label: "Chat", href: "/" },
  { label: "Articles", href: "/articles" },
  { label: "Maps", href: "/maps" },
  { label: "Queue", href: "/queue" },
];

export default function SharedHeader({ onToggleSidebar, sidebarOpen, search }: HeaderProps) {
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false);
      }
    }
    if (mobileNavOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileNavOpen]);

  return (
    <header className="sticky top-0 z-50 header-bar border-b transition-colors duration-300" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-3 md:px-6 h-16 flex items-center justify-between max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3">
          {onToggleSidebar ? (
            // ── Compact: sidebar handles navigation ──
            <>
              <button
                onClick={onToggleSidebar}
                className="btn-icon btn-ghost text-lg lg:!hidden"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {sidebarOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
              <Link href="/" className="no-underline">
                <img src="/logo-icon.png" alt="Truthseekers" className="w-8 h-8" style={{ objectFit: "contain" }} />
              </Link>
            </>
          ) : (
            // ── Full: header is primary navigation ──
            <>
              <Link href="/" className="flex items-center gap-2.5 no-underline">
                <img src="/logo-icon.png" alt="Truthseekers" className="w-8 h-8" style={{ objectFit: "contain" }} />
                <img src="/logo-text.png" alt="Truthseekers" className="hidden sm:inline" style={{ height: 16, width: "auto", objectFit: "contain" }} />
              </Link>
              <div className="hidden sm:flex items-center gap-1 ml-4">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="btn-ghost text-sm font-medium"
                    style={{ color: "var(--muted)" }}
                   
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Header search bar */}
        {search && (
          <div className="hidden sm:flex flex-1 max-w-md mx-4">
            <form onSubmit={search.onSubmit} className="w-full">
              <div className="relative">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--subtle)" }} />
                <input
                  type="text"
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  placeholder={search.placeholder || "Search..."}
                  className="input w-full text-sm py-1.5 pl-9 pr-8"
                />
                {search.value && search.onClear && (
                  <button
                    type="button"
                    onClick={search.onClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon btn-ghost p-0.5"
                    aria-label="Clear search"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* User avatar + settings */}
          {user && (
            <Link href="/settings" className="flex items-center gap-2 no-underline">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background: "var(--accent)",
                  color: "white",
                }}
              >
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <span
                className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: user.subscriptionTier === "pro" ? "var(--accent-bg)" : user.subscriptionTier === "enterprise" ? "#fef3c7" : "var(--border-light)",
                  color: user.subscriptionTier === "pro" ? "var(--accent)" : user.subscriptionTier === "enterprise" ? "#92400e" : "var(--subtle)",
                }}
              >
                {user.subscriptionTier}
              </span>
            </Link>
          )}

          <QueueIndicator />

          <button onClick={toggle} className="btn-icon btn-ghost text-base" aria-label="Toggle theme">
            {resolved === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Mobile nav menu (only when no sidebar) */}
          {!onToggleSidebar && (
            <div className="sm:hidden relative" ref={menuRef}>
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="btn-icon btn-ghost text-base"
                aria-label="Navigation menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              {mobileNavOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl p-2 shadow-lg"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-light)", zIndex: 60 }}
                >
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors hover:bg-[var(--border-light)]"
                      style={{ color: "var(--ink)" }}
                     
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Mobile search */}
      {search && (
        <div className="sm:hidden px-4 pb-3">
          <form onSubmit={search.onSubmit}>
            <div className="relative">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--subtle)" }} />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder || "Search..."}
                className="input w-full text-sm py-2 pl-9 pr-8"
              />
              {search.value && search.onClear && (
                <button
                  type="button"
                  onClick={search.onClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon btn-ghost p-0.5"
                  aria-label="Clear search"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
