"use client";

// ponytail: one loading/error/empty set — every list page reuses these.
export function LoadingRow({ label = "Loading from Veritas…" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
      {label}
    </p>
  );
}

export function ErrorRow({ onRetry }: { onRetry?: () => void }) {
  return (
    <p role="alert" className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">
      Backend unreachable — showing cached entries.{" "}
      {onRetry && (
        <button type="button" onClick={onRetry} className="underline">
          Retry
        </button>
      )}
    </p>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className="font-mono text-[10px] uppercase text-muted">
      {live ? "● live" : "○ offline cache"}
    </span>
  );
}
