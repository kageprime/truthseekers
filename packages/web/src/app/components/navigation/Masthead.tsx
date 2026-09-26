"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TruthseekersLogo from "../TruthseekersLogo";
import ViewControls from "../layout/ViewControls";
import { useUiMode } from "../../context/UiModeContext";
import { useAuth } from "../../hooks/useAuth";
import { useHealth, useContestedClaims, useAllGaps } from "../../hooks";

// ── Newspaper meta ────────────────────────────────────────────────────────
// Issues are counted daily since the founding date (VOL./NO. flourish).
const FOUNDING = new Date(2026, 0, 5);

function editionOf(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Morning Edition";
  if (h < 18) return "Afternoon Edition";
  return "Evening Edition";
}

function volNo(d: Date): string {
  const days = Math.max(0, Math.floor((d.getTime() - FOUNDING.getTime()) / 86_400_000));
  return `Vol. ${Math.floor(days / 365) + 1} · No. ${days + 1}`;
}

// Client-only clock: null on the server, so SSR never disagrees with the
// first paint; the folio holds its place with --:-- until mount.
function useNowTick(ms = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ── Aa view menu — the <xl home of the reading controls ──────────────────
function ViewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Reading view"
        className={`flex items-center justify-center w-7 h-7 rounded-sharp border transition-colors cursor-pointer ${
          open ? "bg-ink text-surface border-ink" : "bg-surface-elevated text-muted border-rule hover:text-ink hover:border-gold"
        }`}
      >
        <span className="font-serif italic font-bold text-[13px] leading-none">Aa</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 p-4 bg-surface-elevated border border-rule rounded-sharp shadow-elev-3 z-50">
          <p className="view-ctl-label">Reading view</p>
          <div className="h-px bg-rule mb-3" aria-hidden />
          <ViewControls />
        </div>
      )}
    </div>
  );
}

function AccountOrb() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Link
        href="/login"
        className="text-xs font-semibold px-3 py-1.5 rounded-sharp bg-ink text-surface hover:bg-gold hover:text-ink transition-colors no-underline"
      >
        Sign in
      </Link>
    );
  }
  return (
    <Link
      href="/settings"
      className="w-7 h-7 rounded-full bg-ink text-surface font-bold flex items-center justify-center text-[11px] no-underline hover:bg-gold hover:text-ink transition-colors shrink-0"
      title={user.name || user.email || "Account"}
    >
      {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
    </Link>
  );
}

/**
 * Masthead — the newspaper nameplate. Identity, date, edition; nothing else.
 * Nav lives in the sidebar (persistent ≥lg, drawer below), reading controls
 * in the Reading desk (≥xl) with the Aa menu as the <xl fallback.
 * One row <lg (3.5rem); folio + nameplate rows ≥lg (5.5rem) = --masthead-h.
 */
export default function Masthead() {
  const { toggleSidebar, sidebarOpen } = useUiMode();
  const now = useNowTick();

  // Epistemic weather — same query keys as the sidebar, cache-shared.
  const { data: health } = useHealth();
  const { data: contestedRes } = useContestedClaims(10);
  const { data: gapsRes } = useAllGaps();
  const entries = (health as any)?.article_count;
  const contested = Array.isArray((contestedRes as any)?.claims) ? (contestedRes as any).claims.length : null;
  const gaps = Array.isArray((gapsRes as any)?.gaps) ? (gapsRes as any).gaps.length : null;

  const dateLong = now
    ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";
  const dateShort = now
    ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";
  const edition = now ? editionOf(now) : "";
  const issue = now ? volNo(now) : "";

  return (
    <header className="masthead">
      {/* ── Compact bar (<lg) ─────────────────────────────────────── */}
      <div className="lg:hidden h-full flex items-center gap-3 px-4">
        <button
          onClick={toggleSidebar}
          className="p-1.5 -ml-1.5 rounded-md text-muted hover:bg-ink/5 transition-colors cursor-pointer"
          title="Browse navigation"
          aria-label="Browse navigation"
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-drawer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-2 no-underline min-w-0 shrink-0">
          <TruthseekersLogo variant="icon" size={22} />
          <span className="font-display font-black text-[15px] uppercase tracking-[0.14em] text-ink">
            Truthseekers
          </span>
        </Link>

        <span className="flex-1" />

        <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-muted tabular-nums truncate">
          {dateShort}
        </span>
        <ViewMenu />
        <AccountOrb />
      </div>

      {/* ── Folio row (≥lg) — date · time · issue … edition · weather ─ */}
      <div className="hidden lg:flex h-8 shrink-0 items-center justify-between gap-4 px-5 xl:px-6 border-b border-rule font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
        <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
          <span className="text-ink font-semibold">{dateLong || "—"}</span>
          <span className="text-rule" aria-hidden>·</span>
          <span className="tabular-nums text-ink" suppressHydrationWarning>{timeStr}</span>
          <span className="text-rule hidden xl:inline" aria-hidden>·</span>
          <span className="hidden xl:inline text-subtle tabular-nums">{issue}</span>
        </div>

        <div className="flex items-center gap-3 min-w-0 whitespace-nowrap">
          <span className="text-gold font-semibold">{edition}</span>
          <span className="text-rule" aria-hidden>·</span>
          <span className="hidden xl:inline text-subtle tabular-nums" title="Epistemic weather">
            {entries != null ? `${entries.toLocaleString()} entries` : "—"}
            {" · "}
            {contested != null ? `${contested} contested` : "…"}
            {" · "}
            {gaps != null ? `${gaps} open gaps` : "…"}
          </span>
          <ViewMenu />
          <AccountOrb />
        </div>
      </div>

      {/* ── Nameplate row (≥lg) — the wordmark under the thin rule ─── */}
      <div className="hidden lg:flex flex-1 min-h-0 flex-col items-center justify-center gap-y-[3px] px-5">
        <Link href="/" className="flex items-center gap-3 no-underline group" title="Truthseekers — home">
          <span aria-hidden className="text-gold text-[11px] transition-transform duration-300 group-hover:rotate-90">◆</span>
          <span className="masthead-title">Truthseekers</span>
          <span aria-hidden className="text-gold text-[11px] transition-transform duration-300 group-hover:rotate-90">◆</span>
        </Link>
        <p className="masthead-strap">The Living Encyclopedia · Follow the Signal</p>
      </div>
    </header>
  );
}


