"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import { IconSearch, IconX } from "./Icons";
import { CATEGORIES } from "./editorial/CategoryIcon";

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

export default function SharedHeader({ search }: HeaderProps) {
  return (
    <header className="header-bar shrink-0 sticky top-0 z-50" style={{ background: "var(--surface)", borderBottom: "1px solid var(--rule)" }}>
      <div className="max-w-[1440px] mx-auto px-3 md:px-6 h-12 flex items-center gap-2">
        {/* Left: logo + wordmark */}
        <Link href="/" className="no-underline flex items-center gap-2 shrink-0">
          <img src="/logo-icon.png" alt="TS" className="shrink-0" style={{ height: 18, width: "auto", objectFit: "contain" }} />
          <span className="masthead-wordmark text-lg leading-none hidden sm:inline" style={{ color: "var(--ink)" }}>Truthseekers</span>
        </Link>

        {/* Center: categories (centered) */}
        <div className="hidden sm:flex flex-1 items-center justify-center gap-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/articles?cat=${encodeURIComponent(cat.slug)}`}
              className="category-link font-serif text-xs whitespace-nowrap no-underline px-1.5 py-0.5"
              style={{ color: "var(--ink-secondary)" }}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {/* Right: search */}
        <div className="flex items-center gap-1 shrink-0">
          {search && (
            <div className="hidden sm:block">
              <form onSubmit={search.onSubmit} className="flex items-center">
                <div className="relative">
                  <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--gold)" }} />
                  <input
                    type="text"
                    value={search.value}
                    onChange={(e) => search.onChange(e.target.value)}
                    placeholder="Search…"
                    className="input text-xs py-1.5 pl-8 pr-2 w-36"
                    style={{ background: "transparent", borderColor: "transparent", borderBottom: "1px solid var(--rule)", borderRadius: 0 }}
                  />
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search bar (below header) */}
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
