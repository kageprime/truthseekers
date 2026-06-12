"use client";

import SharedHeader from "./SharedHeader";

export const DEFAULT_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Maps", href: "/maps" },
  { label: "New Article", href: "/article/new" },
  { label: "Queue", href: "/queue" },
];

interface PageLayoutProps {
  children: React.ReactNode;
  navLinks?: Array<{ label: string; href: string }>;
  showSearch?: boolean;
  query?: string;
  onQueryChange?: (q: string) => void;
  onSearch?: (e: React.FormEvent) => void;
  onClear?: () => void;
  searching?: boolean;
  onGenerate?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  footerText?: string;
}

export default function PageLayout({
  children,
  navLinks = DEFAULT_NAV_LINKS,
  showSearch = false,
  query = "",
  onQueryChange,
  onSearch,
  onClear,
  searching = false,
  onGenerate,
  onKeyDown,
  footerText = "AI-powered encyclopedia · Built with OpenCode SDK",
}: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--warm)" }}>
      <SharedHeader
        links={navLinks}
        showSearch={showSearch}
        query={query}
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        onClear={onClear}
        searching={searching}
        onGenerate={onGenerate}
        onKeyDown={onKeyDown}
      />
      {children}
      <footer className="border-t px-6 py-6" style={{ borderColor: "#dadce0", background: "white" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-sm gap-1" style={{ color: "#5f6368" }}>
          <span className="font-medium" style={{ color: "#1a1a1a" }}>Truthseekers</span>
          <span className="text-xs">{footerText}</span>
        </div>
      </footer>
    </div>
  );
}
