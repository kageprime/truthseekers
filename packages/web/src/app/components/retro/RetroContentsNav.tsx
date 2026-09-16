"use client";
import Link from "next/link";
import { useState } from "react";
import { NAV_GROUPS, RETRO_ROUTES } from "@/lib/routes";
import { useTimeMachine } from "../../hooks/useTimeMachine";
import { useAuth } from "../../hooks/useAuth";
import { IconBook, IconChat, IconClock, IconGear, IconGraph, IconHome, IconList, IconMap, IconPencil, IconQuestion, IconScale, IconTag, IconWrench } from "./icons";

const ICONS: Record<string, (p: { size?: number }) => React.ReactNode> = {
  home: IconHome, book: IconBook, graph: IconGraph, scale: IconScale, question: IconQuestion,
  clock: IconClock, map: IconMap, chat: IconChat, tag: IconTag, wrench: IconWrench,
  gear: IconGear, pencil: IconPencil, list: IconList,
};

export interface OutlineItem {
  id: string;
  label: string;
}

export interface SessionItem {
  id: string;
  label: string;
}

export default function RetroContentsNav({ pathname, showAdmin, outline, activeOutline, onOutlineSelect, sessions, activeSessionId, onSelectSession, onNewSession, sessionsLoading, alwaysOpen }: {
  pathname: string;
  showAdmin: boolean;
  outline?: OutlineItem[];
  activeOutline?: string;
  onOutlineSelect?: (id: string) => void;
  sessions?: SessionItem[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onNewSession?: () => void;
  sessionsLoading?: boolean;
  alwaysOpen?: boolean;
}) {
  const [treeOpen, setTreeOpen] = useState(false);
  const navOpen = alwaysOpen || treeOpen;
  const { activeEra, isActive, toggleOpen } = useTimeMachine();
  const { user, logout } = useAuth();

  return (
    <div className="r-side w-full lg:w-[240px] shrink-0 h-full flex flex-col justify-between win7-nav-pane transition-colors duration-200">
      {/* Mobile Toggle */}
      {!alwaysOpen && (
        <button
          className="lg:hidden bg-[#1b6ec2] text-white text-[11px] font-bold px-3 py-2 flex items-center justify-between w-full shadow-sm"
          onClick={() => setTreeOpen((o) => !o)}
          aria-expanded={treeOpen}
          aria-controls="retro-contents"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            ENCYCLOPEDIA NAVIGATION
          </span>
          <span aria-hidden>{treeOpen ? "▾" : "▸"}</span>
        </button>
      )}

      {/* Main Nav Tree */}
      <div className={`flex-1 min-h-0 overflow-auto r-scroll ${navOpen ? "block max-h-[50dvh]" : "hidden"} lg:block lg:max-h-none p-2.5 space-y-3`}>
        <nav id="retro-contents" aria-label="Site contents" className="space-y-3">
          {NAV_GROUPS.map((g) => (
            <div key={g} className="space-y-1">
              <div className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 text-[var(--r-muted)] w-full">
                {g}
              </div>
              <div className="space-y-0.5">
                {RETRO_ROUTES.filter((r) => r.group === g && !r.hideInNav && (!r.adminOnly || showAdmin)).map(({ href, label, icon }) => {
                  const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
                  const Icon = ICONS[icon] ?? IconBook;
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setTreeOpen(false)}
                      className={`win7-nav-item ${active ? "win7-nav-item-active" : ""}`}
                    >
                      <span className="inline-flex shrink-0 opacity-90" aria-hidden>
                        <Icon size={14} />
                      </span>
                      <span className="flex-1 leading-snug truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Chat sessions */}
          {sessions !== undefined && (
            <div className="space-y-1 pt-2 mt-1 border-t border-[var(--r-border)]">
              <div className="flex items-center justify-between px-2.5 py-0.5">
                <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--r-muted)]">
                  Sessions
                </div>
                {onNewSession && (
                  <button
                    onClick={onNewSession}
                    aria-label="New chat"
                    className="aero-btn text-[10px] py-0.5 px-1.5"
                  >
                    + New
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {sessionsLoading ? (
                  <div className="px-2 py-4 text-[11px] text-center text-[var(--r-muted)]">Loading…</div>
                ) : sessions.length === 0 ? (
                  <div className="px-2 py-4 text-[11px] text-center text-[var(--r-muted)]">No conversations yet</div>
                ) : (
                  sessions.map((s) => {
                    const isActive = activeSessionId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => { onSelectSession?.(s.id); if (!alwaysOpen) setTreeOpen(false); }}
                        aria-current={isActive ? "true" : undefined}
                        className={`win7-nav-item w-full text-left cursor-pointer ${isActive ? "win7-nav-item-active" : ""}`}
                      >
                        <span className="block truncate leading-snug">{s.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Article page outline */}
          {outline && outline.length > 0 && (
            <div className="space-y-1 pt-2 mt-1 border-t border-[var(--r-border)]">
              <div className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-0.5 text-[var(--r-muted)]">
                On this page
              </div>
              <div className="space-y-0.5">
                {outline.map((s) => {
                  const isActive = activeOutline === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onOutlineSelect?.(s.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`win7-nav-item w-full text-left cursor-pointer ${isActive ? "win7-nav-item-active" : ""}`}
                    >
                      <span aria-hidden className="shrink-0 opacity-70">▪</span>
                      <span className="flex-1 leading-snug truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time Machine toggle */}
          <div className="pt-2">
            <button
              onClick={toggleOpen}
              aria-label="Toggle Time Machine"
              title={isActive ? `Time Machine: ${activeEra} — click to change` : "Time Machine — explore history as of an era"}
              className={`win7-nav-item w-full text-left cursor-pointer ${isActive ? "win7-nav-item-active" : ""}`}
            >
              <span aria-hidden className="inline-flex shrink-0">⏳</span>
              <span className="flex-1 leading-snug truncate">Time Machine{isActive ? ` — ${activeEra}` : ""}</span>
            </button>
          </div>

          {/* Word of the Day Box */}
          <div className="aero-glass-panel p-2.5 rounded-[var(--r-radius)] mt-2">
            <div className="text-[9px] font-bold bg-[#1b6ec2] text-white px-1.5 py-0.5 inline-block rounded-sm mb-1 uppercase tracking-wider">
              Word of the Day
            </div>
            <div className="text-[13px] font-bold text-[#0c2038]" style={{ fontFamily: "Georgia, serif" }}>
              pis·ci·vore
            </div>
            <div className="text-[11px] leading-snug mt-0.5 text-slate-600">
              <i>n.</i> A fish-eating animal or organism.
            </div>
          </div>
        </nav>
      </div>

      {/* Windows 7 Start Menu User Profile Orb Footer */}
      <div className="win7-user-orb p-2.5 shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="win7-avatar-frame shrink-0 flex items-center justify-center font-bold text-white text-xs shadow-inner">
            {(user?.email?.[0] || user?.name?.[0] || "T").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-[#0c2038] truncate leading-tight">
              {user?.name || user?.email?.split("@")[0] || "TruthSeeker"}
            </div>
            <div className="text-[10px] text-slate-600 font-medium truncate flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="capitalize">{user?.role || "Explorer"}</span>
            </div>
          </div>
        </div>
        {user ? (
          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="aero-btn text-[10px] px-2 py-1 shrink-0"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="aero-btn text-[10px] px-2 py-1 shrink-0 no-underline"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
