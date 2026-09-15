"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_GROUPS, RETRO_ROUTES } from "@/lib/routes";
import { IconBack, IconFwd, IconBook, IconChat, IconClock, IconGear, IconGraph, IconHome, IconList, IconMap, IconPencil, IconQuestion, IconScale, IconTag, IconWrench } from "./icons";

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
  const router = useRouter();
  const [treeOpen, setTreeOpen] = useState(false);
  const navOpen = alwaysOpen || treeOpen;

  return (
    <div className="r-side w-full lg:w-[260px] shrink-0 bg-[var(--r-nav-bg)] border-r border-[var(--r-border)] flex flex-col rounded-[var(--r-radius)] transition-colors duration-200">
      {/* Mobile Toggle */}
      {!alwaysOpen && (
      <button
        className="lg:hidden bg-[var(--r-accent)] text-white text-[11px] font-bold px-3 py-2 flex items-center justify-between w-full"
        onClick={() => setTreeOpen((o) => !o)}
        aria-expanded={treeOpen}
        aria-controls="retro-contents"
      >
        <span>ENCYCLOPEDIA CONTENTS</span>
        <span aria-hidden>{treeOpen ? "▾" : "▸"}</span>
      </button>
      )}

      {/* Desktop Header */}
      <div className="hidden lg:flex bg-[var(--r-accent)] text-white text-[11px] font-bold px-3 py-1.5 items-center justify-between">
        <span>Contents</span>
        <span className="bg-[var(--r-header-accent)] text-black px-1.5 py-0.5 text-[9px] font-bold border border-black/50 rounded-sm">
          INDEX
        </span>
      </div>

      {/* Contents Tree */}
      <nav id="retro-contents" className={`${navOpen ? "block max-h-[50dvh]" : "hidden"} lg:block lg:max-h-none p-2.5 space-y-3 overflow-auto r-scroll`} aria-label="Site contents">
        {NAV_GROUPS.map((g) => (
          <div key={g} className="space-y-1">
            <div className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 text-[var(--r-muted)]">
              {g}
            </div>
            <div className="space-y-0.5">
              {RETRO_ROUTES.filter((r) => r.group === g && !r.hideInNav && (!r.adminOnly || showAdmin)).map(({ href, label, icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                const Icon = ICONS[icon] ?? IconBook;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setTreeOpen(false)}
                    className={`w-full text-left px-2.5 py-1.5 text-[12px] flex items-center gap-2 border rounded-[var(--r-radius)] no-underline transition-colors ${
                      active
                        ? "bg-[var(--r-accent)] text-white border-[var(--r-accent)] font-semibold shadow-sm"
                        : "bg-transparent border-transparent hover:bg-black/5 text-[var(--r-ink)]"
                    }`}
                    style={active ? { color: "#ffffff" } : undefined}
                  >
                    <span className="inline-flex shrink-0 opacity-85" aria-hidden>
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 leading-snug">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {/* ponytail: chat injects sessions here so site menu + chat drawer share one component. */}
        {sessions !== undefined && (
          <div className="space-y-1 pt-2 mt-1 border-t border-[var(--r-border)]">
            <div className="flex items-center justify-between px-2 py-0.5">
              <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--r-muted)]">
                Sessions
              </div>
              {onNewSession && (
                <button
                  onClick={onNewSession}
                  aria-label="New chat"
                  className="text-[10px] font-bold px-1.5 py-0.5 border border-[var(--r-border)] rounded-[var(--r-radius)] hover:bg-black/5 text-[var(--r-ink)] cursor-pointer"
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
                      className={`w-full text-left px-2.5 py-1.5 text-[12px] border rounded-[var(--r-radius)] transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[var(--r-accent)] border-[var(--r-accent)] font-semibold shadow-sm"
                          : "bg-transparent border-transparent hover:bg-black/5 text-[var(--r-ink)]"
                      }`}
                      style={isActive ? { color: "#ffffff" } : undefined}
                    >
                      <span className="block truncate leading-snug">{s.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        {/* ponytail: article pages inject their outline here so every page
            shares one nav component instead of a bespoke sidebar. */}
        {outline && outline.length > 0 && (
          <div className="space-y-1 pt-2 mt-1 border-t border-[var(--r-border)]">
            <div className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 text-[var(--r-muted)]">
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
                    className={`w-full text-left px-2.5 py-1.5 text-[12px] flex items-center gap-2 border rounded-[var(--r-radius)] transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[var(--r-accent)] border-[var(--r-accent)] font-semibold shadow-sm"
                        : "bg-transparent border-transparent hover:bg-black/5 text-[var(--r-ink)]"
                    }`}
                    style={isActive ? { color: "#ffffff" } : undefined}
                  >
                    <span aria-hidden className="shrink-0 opacity-70">▪</span>
                    <span className="flex-1 leading-snug">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Word of the Day Box */}
      <div className="mt-2 mx-2.5 border bg-[var(--r-surface-elevated)] p-2.5 hidden lg:block rounded-[var(--r-radius)]" style={{ borderColor: "var(--r-border)" }}>
        <div className="text-[9px] font-bold bg-[var(--r-header-accent)] text-black px-1.5 py-0.5 inline-block border border-black/30 mb-1 rounded-sm">
          WORD OF THE DAY
        </div>
        <div className="text-[13px] font-bold" style={{ fontFamily: "Georgia, serif", color: "var(--r-ink)" }}>
          pis·ci·vore
        </div>
        <div className="text-[11px] leading-snug mt-0.5" style={{ color: "var(--r-ink-secondary)" }}>
          <i>n.</i> A fish-eating animal or organism.
        </div>
      </div>

      {/* Action Footer — ponytail: compact icon-only row, same on mobile. */}
      <div className="mt-auto p-1.5 flex gap-1 border-t border-[var(--r-border)]" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
        <button className="r-btn flex-1 inline-flex items-center justify-center px-1 py-1" onClick={() => router.back()} aria-label="Go back" title="Back">
          <IconBack size={12} />
        </button>
        <button className="r-btn flex-1 inline-flex items-center justify-center px-1 py-1" onClick={() => router.forward()} aria-label="Go forward" title="Forward">
          <IconFwd size={12} />
        </button>
        <button className="r-btn flex-1 inline-flex items-center justify-center px-1 py-1" onClick={() => router.push("/article/new")} aria-label="Write a new article" title="New article">
          <IconPencil size={12} />
        </button>
      </div>
    </div>
  );
}
