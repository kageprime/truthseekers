"use client";

import { useEffect, useState } from "react";

export interface TourStep {
  title: string;
  excerpt: string;
}

// ponytail: a reading tour, not a product tour — steps glide the article to
// each section heading (matched by title text), falling back to fractional
// scroll when a heading isn't found.
export default function ArticleTour({
  steps,
  scrollRoot,
  onClose,
}: {
  steps: TourStep[];
  scrollRoot: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, i));
    setIdx(clamped);
    const root = scrollRoot.current;
    const step = steps[clamped];
    if (root && step) {
      const headings = Array.from(root.querySelectorAll("h1, h2"));
      const hit = headings.find(
        (h) => (h.textContent || "").trim().toLowerCase() === step.title.trim().toLowerCase(),
      );
      if (hit) {
        hit.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const top = (root.scrollHeight * (clamped + 1)) / (steps.length + 1);
        root.scrollTo({ top, behavior: "smooth" });
      }
    }
  };

  // Glide to the opening step when the tour starts.
  useEffect(() => {
    goTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape ends the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const step = steps[idx];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6 pointer-events-none" role="dialog" aria-label="Article tour">
      <div className="pointer-events-auto w-full max-w-xl border border-rule rounded-sharp bg-surface-elevated shadow-elev-3 p-5 space-y-2 animate-appear-up">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold">
            Guided tour · {idx + 1} of {steps.length}
          </span>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm cursor-pointer"
            aria-label="End tour"
          >
            ✕
          </button>
        </div>
        <h3 className="font-display text-xl font-bold text-ink">{step.title}</h3>
        <p className="font-serif italic text-sm text-muted line-clamp-2">{step.excerpt}</p>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="category-link no-underline text-sm font-semibold cursor-pointer disabled:opacity-30"
          >
            ← Prev
          </button>
          {idx + 1 >= steps.length ? (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-sharp bg-ink text-surface font-semibold text-xs hover:bg-gold hover:text-ink transition-colors cursor-pointer"
            >
              Finish tour
            </button>
          ) : (
            <button
              onClick={() => goTo(idx + 1)}
              className="category-link no-underline text-sm font-semibold cursor-pointer"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
