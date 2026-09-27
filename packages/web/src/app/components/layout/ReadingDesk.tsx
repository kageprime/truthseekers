"use client";

import ViewControls from "./ViewControls";
import { useReadingDesk } from "../../context/ReadingDeskContext";

/**
 * ReadingDesk — the right-hand rail of the dual-rail layout (≥xl).
 * Site-wide, like a newspaper's tools column. It is one slot with two
 * tenants: a page panel pushed through ReadingDeskContext (claim details,
 * page tools) takes precedence; otherwise the reading view controls show.
 * The rail is sticky and scrolls on its own — never with the page.
 */
export default function ReadingDesk() {
  const { panel, hasPanel } = useReadingDesk();

  return (
    <aside
      className={`hidden xl:flex shrink-0 border-l border-rule bg-surface xl:sticky xl:top-[var(--masthead-h)] xl:h-[calc(100dvh_-_var(--masthead-h))] xl:self-start xl:overflow-y-auto ${
        hasPanel ? "w-80 2xl:w-96" : "w-64 2xl:w-72"
      }`}
      aria-label="Reading desk"
    >
      {hasPanel ? (
        <div className="w-full">{panel}</div>
      ) : (
        <div className="w-full p-5 space-y-5">
          <div className="space-y-0.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gold font-semibold">
              Reading desk
            </p>
            <p className="text-[11px] font-serif italic text-muted">
              How the paper is set
            </p>
          </div>

          <div className="h-px bg-rule" aria-hidden />

          <ViewControls />
        </div>
      )}
    </aside>
  );
}