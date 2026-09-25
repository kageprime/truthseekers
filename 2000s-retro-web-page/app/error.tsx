"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-paper px-5 py-24 text-ink">
      <h1 className="font-sans text-4xl font-bold">Something broke.</h1>
      <p className="mt-4 max-w-md font-serif text-lg">The page hit an error. The backend may be down.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 border border-ink px-4 py-2 font-mono text-[11px] uppercase"
      >
        Try again
      </button>
    </main>
  );
}
