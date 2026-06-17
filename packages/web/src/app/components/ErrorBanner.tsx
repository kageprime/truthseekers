"use client";

import { IconXCircle } from "./Icons";

interface ErrorBannerProps {
  error: string;
  onRetry: () => void;
}

export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-6 my-4 p-4 rounded-xl border" style={{ background: "var(--red-subtle)", borderColor: "var(--red)" }}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5"><IconXCircle size={20} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>Something went wrong</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{error}</p>
          <button onClick={onRetry} className="btn btn-sm mt-3" style={{ background: "var(--accent)", color: "white" }}>Try Again</button>
        </div>
      </div>
    </div>
  );
}
