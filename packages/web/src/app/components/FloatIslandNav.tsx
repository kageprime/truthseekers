"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../hooks/useAuth";
import Avatar from "./Avatar";

// ─── SVG Icons ────────────────────────────────────────────────────

function ChatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ArticleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function MapIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function SettingsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ─── NAV_LINKS ─────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/articles", label: "Articles", icon: ArticleIcon },
  { href: "/maps", label: "Maps", icon: MapIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

// ─── Nav link ────────────────────────────────────────────────────

function NavLink({ href, isActive, icon: Icon, label }: {
  href: string;
  isActive: boolean;
  icon: React.ComponentType<{ size: number }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium no-underline transition-all duration-200"
      style={{ color: isActive ? "var(--accent)" : "var(--muted)" }}
    >
      <Icon size={16} />
      <span className="hidden lg:inline">{label}</span>
      {isActive && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full" style={{ background: "var(--accent)" }} />
      )}
    </Link>
  );
}

// ─── Top header ──────────────────────────────────────────────────

function TopHeader({ pathname }: { pathname: string }) {
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();

  return (
    <header
      className="hidden md:flex items-center justify-between px-5"
      style={{
        height: "3rem",
        background: "var(--surface-glass)",
        backdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid var(--glass-border)",
        zIndex: "var(--z-header)",
      }}
    >
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-2 no-underline shrink-0 -ml-1">
        <img src="/logo-icon.png" alt="" height={20} style={{ height: 20, width: "auto" }} />
        <span className="text-xs font-semibold tracking-tight" style={{ color: "var(--ink)" }}>Truthseekers</span>
      </Link>

      {/* Center: Nav links */}
      <nav className="flex items-center gap-0">
        {NAV_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} isActive={pathname.startsWith(link.href)} icon={link.icon} label={link.label} />
        ))}
      </nav>

      {/* Right: Theme + Avatar */}
      <div className="flex items-center gap-1.5">
        <button onClick={toggle} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-accent-bg/30 transition-all duration-200 cursor-pointer" style={{ background: "none", border: "none" }} aria-label="Toggle theme">
          {resolved === "dark" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>
        {user && (
          <Link href="/settings" className="shrink-0">
            <Avatar src={user.avatar || undefined} alt={user.name} size="sm" />
          </Link>
        )}
      </div>
    </header>
  );
}

// ─── Bottom dock (mobile) ───────────────────────────────────────

function DockLink({ href, isActive, icon: Icon, label }: {
  href: string;
  isActive: boolean;
  icon: React.ComponentType<{ size: number }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center justify-center no-underline"
      style={{
        width: "2.5rem",
        height: "2.5rem",
        borderRadius: "0.625rem",
        color: isActive ? "var(--surface)" : "var(--muted)",
        background: isActive ? "var(--accent)" : "transparent",
      }}
      title={label}
    >
      <Icon size={18} />
    </Link>
  );
}

function BottomDock({ pathname }: { pathname: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <div className="flex flex-row items-center gap-1 px-2.5 py-1.5" style={{
      borderRadius: "1rem",
      background: "var(--surface-glass)",
      backdropFilter: "blur(24px) saturate(1.4)",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    }}>
      <a href="/" className="block"><img src="/logo-icon.png" alt="Truthseekers" height={24} style={{ height: 24, width: "auto", objectFit: "contain", padding: "0.125rem" }} /></a>

      <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: "var(--glass-border)" }} />

      <div className="flex flex-row items-center gap-0">
        {NAV_LINKS.map((link) => (
          <DockLink key={link.href} href={link.href} isActive={pathname.startsWith(link.href)} icon={link.icon} label={link.label} />
        ))}
      </div>

      <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: "var(--glass-border)" }} />

      <button onClick={toggle} className="p-1 rounded-full text-muted hover:text-ink hover:bg-accent-bg/30 transition-all duration-200 cursor-pointer">
        {resolved === "dark" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        )}
      </button>
    </div>
  );
}

// ─── Mobile header (non-chat pages) ────────────────────────────

function MobileHeader({ pathname }: { pathname: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();

  // Chat pages render their own mobile header
  if (pathname.startsWith("/chat")) return null;

  return (
    <>
      <header
        className="md:hidden flex items-center justify-between px-3"
        style={{
          height: "2.75rem",
          background: "var(--surface-glass)",
          backdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: "1px solid var(--glass-border)",
          zIndex: "var(--z-header)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-accent-bg/20 transition-all"
          aria-label="Open menu"
          style={{ background: "none", border: "none" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-2 no-underline">
          <img src="/logo-icon.png" alt="" height={18} style={{ height: 18, width: "auto" }} />
          <span className="text-xs font-semibold tracking-tight" style={{ color: "var(--ink)" }}>Truthseekers</span>
        </Link>

        <div className="w-8 flex items-center justify-center">
          {user ? (
            <Link href="/settings" className="shrink-0">
              <Avatar src={user.avatar || undefined} alt={user.name} size="sm" />
            </Link>
          ) : (
            <div className="w-8" />
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0" style={{ zIndex: 50 }}>
          <div className="absolute inset-0 bg-black/40 animate-appear-blur" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-surface border-r border-border/30 shadow-2xl animate-slide-in-left">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-border/30">
              <div className="flex items-center gap-2">
                <img src="/logo-icon.png" alt="" height={18} style={{ height: 18, width: "auto" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Truthseekers</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-subtle hover:text-ink hover:bg-accent-bg/20 transition-all"
                aria-label="Close menu"
                style={{ background: "none", border: "none" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 px-3 pt-3 space-y-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg no-underline transition-colors hover:bg-accent-bg/15"
                  style={{
                    color: pathname.startsWith(link.href) ? "var(--accent)" : "var(--muted)",
                    background: pathname.startsWith(link.href) ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                  }}
                >
                  <link.icon size={18} />
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>

            {/* Bottom: theme toggle */}
            <div className="shrink-0 px-3 pb-4 pt-2 border-t border-border/20 mt-2">
              <button
                onClick={toggle}
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg w-full text-left transition-colors hover:bg-accent-bg/15"
                style={{ color: "var(--muted)", background: "none", border: "none" }}
              >
                {resolved === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
                <span>{resolved === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Entry point ──────────────────────────────────────────────────

export default function FloatIslandNav() {
  const pathname = usePathname();

  return (
    <>
      <TopHeader pathname={pathname} />
      <MobileHeader pathname={pathname} />
    </>
  );
}
