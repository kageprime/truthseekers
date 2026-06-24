"use client";

import Link from "next/link";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 py-16 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "color-mix(in srgb, var(--oxblood) 12%, transparent)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oxblood)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: "var(--ink)" }}>Something went wrong</h2>
      <p className="text-xs mb-6 max-w-sm" style={{ color: "var(--muted)" }}>
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex items-center gap-3">
        <button onClick={reset} className="btn btn-primary cursor-pointer">Try again</button>
        <Link href="/" className="btn btn-secondary no-underline">Back to home</Link>
      </div>
    </div>
  );
}
