import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 py-16 text-center">
      <div
        className="pointer-events-none select-none mb-4 font-display"
        style={{
          fontSize: "clamp(4rem, 15vw, 8rem)",
          fontWeight: 900,
          lineHeight: 1,
          color: "var(--gold)",
          opacity: 0.15,
        }}
        aria-hidden="true"
      >
        404
      </div>
      <h2 className="text-base font-semibold mb-2" style={{ color: "var(--ink)" }}>
        Page not found
      </h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "var(--muted)" }}>
        The article or page you are looking for does not exist. It may have been moved or never existed.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/" className="btn btn-primary no-underline">
          Back to home
        </Link>
        <Link href="/articles" className="btn btn-secondary no-underline">
          Browse articles
        </Link>
      </div>
    </div>
  );
}
