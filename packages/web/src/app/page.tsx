"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useCreateChat } from "./hooks";
import PageLayout from "./components/PageLayout";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState("");
  const { mutate: createChat, loading: busy } = useCreateChat();
  const [submitted, setSubmitted] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const query = input.trim();
    setSubmitted(query);
    const conv = await createChat(query);
    if (conv) {
      router.push(`/chat/${conv.id}?q=${encodeURIComponent(query)}`);
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center py-24" style={{ background: "var(--surface)" }}>
        <div className="w-8 h-8 rounded-full border-3 animate-spin"
          style={{ borderColor: "var(--ink)", borderTopColor: "var(--accent)" }} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex flex-col items-center px-6 pt-24 text-center"
        style={{ background: "var(--surface)" }}>
        <div className="max-w-2xl animate-fade-slide-up">
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full"
            style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-subtle)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            AI-Powered Knowledge
          </div>
          <h1 className="text-5xl sm:text-7xl font-display font-bold tracking-tight mb-4 leading-tight"
            style={{ color: "var(--ink)" }}>
            Truthseekers
          </h1>
          <p className="text-lg sm:text-xl mb-8 font-serif italic" style={{ color: "var(--muted)" }}>
            The Living Encyclopedia
          </p>
          <p className="text-sm max-w-lg mx-auto mb-10 leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
            AI agents research, write, verify, and illustrate articles on any topic.
            Browse the collection or generate a new entry.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link href="/login" className="btn btn-primary btn-lg px-8 text-base no-underline shadow-sm">
              Sign In to Start
            </Link>
            <Link href="/articles" className="btn btn-secondary btn-lg px-8 text-base no-underline">
              Browse the Encyclopedia
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-left mb-12">
            <div className="border-t-2 pt-4" style={{ borderColor: "var(--accent)" }}>
              <h3 className="font-display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>Research</h3>
              <p className="text-sm leading-relaxed font-serif" style={{ color: "var(--muted)" }}>
                Deep research across web sources, synthesized into structured articles with verified citations.
              </p>
            </div>
            <div className="border-t-2 pt-4" style={{ borderColor: "var(--accent)" }}>
              <h3 className="font-display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>Write</h3>
              <p className="text-sm leading-relaxed font-serif" style={{ color: "var(--muted)" }}>
                Full article generation with rich media — images, maps, timelines, and diagrams.
              </p>
            </div>
            <div className="border-t-2 pt-4" style={{ borderColor: "var(--accent)" }}>
              <h3 className="font-display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>Verify</h3>
              <p className="text-sm leading-relaxed font-serif" style={{ color: "var(--muted)" }}>
                AI cross-checks every citation, corrects errors, and version-controls all changes.
              </p>
            </div>
          </div>

          <p className="text-xs" style={{ color: "var(--subtle)" }}>
            <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>Sign in</Link> to start researching. Already have an account?
          </p>
        </div>
      </main>
    );
  }

  return (
    <PageLayout sidebar sidebarDefaultCollapsed>
      <main className="flex-1 flex flex-col items-center px-6 pt-12 relative">

        {busy ? (
          /* ── Loading transition ── */
          <div className="flex flex-col items-center gap-4 animate-fade-slide-up" style={{ animationDelay: "0ms" }}>
            <div
              className="w-10 h-10 rounded-full border-3 animate-spin"
              style={{
                borderColor: "var(--ink)",
                borderTopColor: "var(--accent)",
              }}
            />
            <p className="text-lg font-semibold text-center max-w-md leading-snug" style={{ color: "var(--ink)" }}>
              {submitted}
            </p>
            <p className="text-sm animate-pulse" style={{ color: "var(--subtle)" }}>
              Preparing your conversation...
            </p>
          </div>
        ) : (
          /* ── Hero content ── */
            <div className="flex flex-col items-center animate-fade-slide-up w-full" style={{ animationDelay: "0ms" }}>
              <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full"
                style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-subtle)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                Encyclopedia
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-bold tracking-tight text-center mb-2"
                style={{ color: "var(--ink)" }}>
                Truthseekers
              </h1>
              <p className="text-base font-serif italic text-center mb-10" style={{ color: "var(--muted)" }}>
              The Living Encyclopedia
            </p>

            <form onSubmit={handleSubmit} className="w-full max-w-2xl">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Search or ask about any topic..."
                  className="flex-1 input text-base py-4 px-5"
                  autoFocus
                />
                <button type="submit" disabled={!input.trim()} className="btn btn-primary btn-lg shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Search
                </button>
              </div>
            </form>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "var(--subtle)" }}>
              <Link href="/articles" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>Browse Articles</Link>
              <span>&middot;</span>
              <Link href="/maps" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>Maps</Link>
              <span>&middot;</span>
              <Link href="/queue" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>Queue</Link>
            </div>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
