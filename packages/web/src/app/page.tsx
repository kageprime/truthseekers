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
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <div className="w-8 h-8 rounded-full border-3 animate-spin"
          style={{ borderColor: "var(--ink)", borderTopColor: "var(--accent)" }} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: "var(--surface)" }}>
        <div className="max-w-lg animate-fade-slide-up">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter mb-3" style={{ color: "var(--ink)" }}>
            Truthseekers
          </h1>
          <p className="text-lg mb-8" style={{ color: "var(--muted)" }}>
            The Living Encyclopedia — AI-powered knowledge at your fingertips.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link href="/login" className="btn btn-primary btn-lg px-8 text-base no-underline">
              Sign In to Start
            </Link>
            <Link href="/articles" className="btn btn-secondary btn-lg px-8 text-base no-underline">
              Browse Public Articles
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left mb-12">
            <div className="glass-card-static p-5">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>AI Research</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Deep research across web sources, synthesized into structured articles.
              </p>
            </div>
            <div className="glass-card-static p-5">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>Living Knowledge</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Articles that grow and update over time with version history.
              </p>
            </div>
            <div className="glass-card-static p-5">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>Interactive Maps</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Explore visualized data with 2D and 3D map views.
              </p>
            </div>
          </div>

          <p className="text-xs" style={{ color: "var(--subtle)" }}>
            <Link href="/login" className="hover:underline" style={{ color: "var(--accent)" }}>Sign in</Link> to start researching. Already have an account?
          </p>
        </div>
      </main>
    );
  }

  return (
    <PageLayout sidebar sidebarDefaultCollapsed noHeader noFooter>
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16 relative">

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
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-center mb-2"
                style={{ color: "var(--ink)" }}>
                Truthseekers
              </h1>
              <p className="text-lg text-center mb-10" style={{ color: "var(--muted)" }}>
              The Living Encyclopedia
            </p>

            <form onSubmit={handleSubmit} className="w-full max-w-2xl">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any topic..."
                  className="flex-1 input text-base py-4 px-5"
                  autoFocus
                />
                <button type="submit" disabled={!input.trim()} className="btn btn-primary btn-lg shrink-0">
                  Ask
                </button>
              </div>
            </form>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "var(--subtle)" }}>
              <Link href="/articles" className="hover:underline" style={{ color: "var(--accent)" }}>Browse Articles</Link>
              <span>&middot;</span>
              <Link href="/maps" className="hover:underline" style={{ color: "var(--accent)" }}>Maps</Link>
              <span>&middot;</span>
              <Link href="/queue" className="hover:underline" style={{ color: "var(--accent)" }}>Queue</Link>
            </div>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
