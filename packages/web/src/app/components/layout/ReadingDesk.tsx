"use client";

import ViewControls from "./ViewControls";

/**
 * ReadingDesk — the right-hand rail of the dual-rail layout (≥xl).
 * Site-wide, like a newspaper's tools column: reading preferences on top,
 * a reserved slot below for page context (claim sidenotes, page tools)
 * once a page fills it.
 */
export default function ReadingDesk() {
  return (
    <aside
      className="hidden xl:flex shrink-0 w-64 2xl:w-72 border-l border-rule bg-surface"
      aria-label="Reading desk"
    >
      <div className="sticky top-[calc(var(--masthead-h)_+_1.25rem)] w-full p-5 space-y-5 self-start">
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

        {/* Page-context slot — claim sidenotes / page tools join here. */}
      </div>
    </aside>
  );
}