import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-paper px-5 py-24 text-ink">
      <h1 className="font-sans text-6xl font-bold">Lost.</h1>
      <p className="mt-4 font-serif text-xl">No entry at this address.</p>
      <Link href="/" className="mt-8 inline-block underline font-mono text-[11px] uppercase">
        Back to index
      </Link>
    </main>
  );
}
