"use client";

import { useState } from "react";
import TruthseekersLogo from "./TruthseekersLogo";
import QueueIndicator from "./QueueIndicator";
import HamburgerMenu from "./HamburgerMenu";

interface HeaderProps {
  links?: Array<{ label: string; href: string }>;
  showSearch?: boolean;
  query?: string;
  onQueryChange?: (q: string) => void;
  onSearch?: (e: React.FormEvent) => void;
  onClear?: () => void;
  searching?: boolean;
  onGenerate?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function SharedHeader({
  links = [],
  showSearch = false,
  query = "",
  onQueryChange,
  onSearch,
  onClear,
  searching = false,
  onGenerate,
  onKeyDown,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ borderColor: "#dadce0", background: "white" }}>
      {/* Wave background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill="var(--blue)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <TruthseekersLogo />

          <div className="flex items-center gap-3">
            <QueueIndicator />

            {/* Desktop nav links */}
            {links.length > 0 && (
              <div className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "#5f6368" }}>
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="hover:text-[#1a1a1a] hover:underline transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {/* Mobile hamburger */}
            <HamburgerMenu>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-sm font-medium hover:bg-[#f1f3f4] rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </HamburgerMenu>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && onSearch && (
          <form onSubmit={onSearch} className="mt-4 max-w-2xl">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#9aa0a6" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange?.(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search..."
                  className="w-full pixel-input"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="pixel-btn shrink-0"
                style={{ background: "var(--orange)", color: "white", border: "2px solid var(--ink)" }}
              >
                {searching ? "..." : "Search"}
              </button>
              {onGenerate && query && (
                <button
                  type="button"
                  onClick={onGenerate}
                  className="pixel-btn shrink-0"
                  style={{ background: "var(--orange)", color: "white", border: "2px solid var(--ink)" }}
                >
                  ⚡ Generate
                </button>
              )}
              {query && onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="pixel-btn shrink-0"
                  style={{ background: "white" }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </header>
  );
}
