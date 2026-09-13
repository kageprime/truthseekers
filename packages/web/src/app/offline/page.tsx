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
    <main>
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">TruthSeekers • No connection</div>
        <h1 className="r-h1 mt-1" style={{ fontSize: 28 }}>You are offline</h1>
        <p className="text-[11px] mt-1" style={{ color: "#555" }}>
          Articles and pages you have already opened are kept on this device and stay readable. Chat and generation need a connection.
        </p>
      </div>
      <div className="bg-[#ffffe1] border-[2px] p-3 text-[12px] leading-[1.5] text-black" style={{ borderStyle: "outset", borderWidth: 2 }}>
        While you wait: open the <span className="font-bold">Contents</span> tree to revisit cached articles, or press the <span className="font-bold">Go to…</span> button in the title bar to jump from recent pages.
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Link href="/" className="r-btn inline-block px-4 py-1.5 no-underline text-black">Back to safety</Link>
        <Link href="/articles" className="text-[11px] font-bold text-[#0a2a5e] underline">Browse cached articles</Link>
      </div>
    </main>
  );
}
