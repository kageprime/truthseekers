"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChat } from "@/lib/api";
import PageLayout from "./components/PageLayout";

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const query = input.trim();
    setSubmitted(query);
    setBusy(true);
    try {
      const conv = await createChat(query);
      if (conv) {
        router.push(`/chat/${conv.id}?q=${encodeURIComponent(query)}`);
      }
    } catch (err) {
      console.error("Failed to create chat:", err);
      setBusy(false);
    }
  }

  return (
    <PageLayout sidebar>
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16 relative">

        {busy ? (
          /* ── Loading transition ── */
          <div className="flex flex-col items-center gap-4 animate-fade-slide-up" style={{ animationDelay: "0ms" }}>
            <div
              className="w-10 h-10 rounded-full border-3 animate-spin"
              style={{
                borderColor: "var(--ink)",
                borderTopColor: "var(--orange)",
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
                  className="flex-1 pixel-input text-base py-4 px-5"
                  autoFocus
                />
                <button type="submit" disabled={!input.trim()} className="btn-primary btn-lg shrink-0">
                  Ask
                </button>
              </div>
            </form>
            <div className="mt-8 text-xs text-center" style={{ color: "var(--subtle)" }}>
              Try: &ldquo;What was the Renaissance?&rdquo; &middot; &ldquo;Tell me about the Solar System&rdquo; &middot; &ldquo;Show me a map of ancient Rome&rdquo;
            </div>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
