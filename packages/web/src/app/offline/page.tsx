import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Offline — Truthseekers",
  description: "You are offline. Cached articles remain available.",
};

// Static offline fallback served by the service worker when navigations fail.
// Must stay dependency-free (no data fetching) so it precaches reliably.
export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <p className="eyebrow mb-3">No connection</p>
      <h1 className="font-display font-bold mb-3" style={{ fontSize: "clamp(1.75rem, 1.2rem + 2vw, 2.5rem)", color: "var(--ink)", letterSpacing: "-0.02em" }}>
        You are offline
      </h1>
      <p className="text-sm sm:text-base max-w-md leading-relaxed mb-8" style={{ color: "var(--muted)" }}>
        Articles and pages you have already opened are kept on this device and stay readable. Chat and generation need a connection.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link href="/" className="cta-bevel">
          Back to safety
        </Link>
        <Link href="/articles" className="text-sm font-medium underline underline-offset-4" style={{ color: "var(--accent-dark)" }}>
          Browse cached articles
        </Link>
      </div>
    </main>
  );
}
