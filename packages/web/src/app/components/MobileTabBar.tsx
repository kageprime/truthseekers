"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat, IconBook, IconMap } from "./Icons";

function IconGraph({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="8.5" y1="7.5" x2="15.5" y2="16.5" />
      <line x1="8.5" y1="16.5" x2="15.5" y2="7.5" />
      <line x1="6" y1="9" x2="6" y2="15" />
      <line x1="18" y1="9" x2="18" y2="15" />
    </svg>
  );
}

function IconSettings({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface TabItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  matches: (pathname: string) => boolean;
}

const TABS: TabItem[] = [
  {
    label: "Chat",
    href: "/chat",
    icon: IconChat,
    matches: (p) => p.startsWith("/chat"),
  },
  {
    label: "Articles",
    href: "/articles",
    icon: IconBook,
    matches: (p) => p.startsWith("/article") || p === "/articles" || p === "/",
  },
  {
    label: "Maps",
    href: "/maps",
    icon: IconMap,
    matches: (p) => p.startsWith("/maps"),
  },
  {
    label: "Graph",
    href: "/claim-graph",
    icon: IconGraph,
    matches: (p) => p.startsWith("/claim-graph") || p === "/contested",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: IconSettings,
    matches: (p) => p.startsWith("/settings") || p.startsWith("/admin"),
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  // Hide on auth pages + active chat thread (native: thread gets full height for composer).
  if (pathname.startsWith("/login") || pathname.startsWith("/onboarding")) {
    return null;
  }
  if (pathname.startsWith("/chat/") && pathname !== "/chat/new") {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[45] bg-[var(--r-nav-bg,#1a1a24)]/95 backdrop-blur-md border-t border-[var(--r-border,#2d2d3d)] transition-all select-none"
      style={{
        paddingBottom: "max(6px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="grid grid-cols-5 h-12 max-w-md mx-auto items-center px-1">
        {TABS.map((tab) => {
          const isActive = tab.matches(pathname);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center py-1 px-1 transition-all rounded-lg active:scale-95 no-underline ${
                isActive
                  ? "text-[var(--r-accent,#6366f1)] font-semibold"
                  : "text-[var(--r-muted,#9ca3af)] hover:text-[var(--r-ink,#f3f4f6)] opacity-75 hover:opacity-100"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon size={19} />
                {isActive && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[var(--r-accent,#6366f1)] animate-pulse" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
