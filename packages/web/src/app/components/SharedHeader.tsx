"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import QueueIndicator from "./QueueIndicator";
import { useTheme } from "./ThemeProvider";
import { IconSearch, IconX } from "./Icons";
import { useAuth } from "../hooks/useAuth";
import { CategoryRail } from "./editorial/Masthead";

interface HeaderSearch {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClear?: () => void;
  placeholder?: string;
}

interface HeaderProps {
  search?: HeaderSearch;
}

const NAV_LINKS = [
  { label: "Articles", href: "/articles" },
  { label: "Maps", href: "/maps" },
  { label: "Queue", href: "/queue" },
];

export default function SharedHeader({ search }: HeaderProps) {
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
    <header className="header-bar shrink-0 sticky top-0 z-50" style={{ background: "var(--surface)", borderBottom: "1px solid var(--rule)" }}>
      {/* Category rail + utility row */}
      <div className="max-w-[1440px] mx-auto px-3 md:px-6 h-12 flex items-center justify-between gap-3">
        {/* Left: primary nav (desktop) — understated serif links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="category-link font-serif text-sm no-underline px-2 py-1"
              style={{ color: "var(--ink-secondary)" }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Center: search */}
        {search ? (
          <div className="flex-1 max-w-md mx-auto hidden sm:block">
            <form onSubmit={search.onSubmit} className="w-full">
              <div className="relative">
                <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gold)" }} />
                <input
                  type="text"
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  placeholder={search.placeholder || "Search the encyclopedia…"}
                  className="input w-full text-sm py-1.5 pl-9 pr-8"
                  style={{ background: "transparent", borderColor: "transparent", borderBottom: "1px solid var(--rule)", borderRadius: 0 }}
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
        ) : (
          <div className="hidden sm:block flex-1" />
        )}

        {/* Right: utilities */}
        <div className="flex items-center gap-1.5">
          {user && (
            <Link href="/settings" className="flex items-center gap-2 no-underline">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                style={{ background: "var(--gold)", color: "#fff" }}
              >
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <span
                className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sharp hidden md:inline"
                style={{
                  background: user.subscriptionTier === "pro" ? "var(--gold-bg)" : user.subscriptionTier === "enterprise" ? "var(--gold-bg)" : "transparent",
                  color: user.subscriptionTier === "free" ? "var(--subtle)" : "var(--gold)",
                  border: "1px solid var(--rule)",
                }}
              >
                {user.subscriptionTier}
              </span>
            </Link>
          )}

          <QueueIndicator />

          <button onClick={toggle} className="btn-icon btn-ghost" aria-label="Toggle theme">
            {resolved === "dark" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Mobile hamburger */}
          <div className="sm:hidden relative" ref={menuRef}>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="btn-icon btn-ghost"
              aria-label="Navigation menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {mobileNavOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-52 rounded-sharp py-1 shadow-lg"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--rule)", zIndex: 60 }}
              >
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className="block px-3 py-2.5 font-serif text-sm no-underline transition-colors"
                    style={{ color: "var(--ink-secondary)" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category rail — the encyclopedia table of contents */}
      <div className="hidden sm:block border-t" style={{ borderColor: "var(--rule)" }}>
        <CategoryRail />
      </div>

      {/* Mobile search */}
      {search && (
        <div className="sm:hidden px-4 pb-3">
          <form onSubmit={search.onSubmit}>
            <div className="relative">
              <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gold)" }} />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder || "Search…"}
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
