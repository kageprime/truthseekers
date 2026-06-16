"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createChat } from "@/lib/api";
import { useAuth } from "../hooks/useAuth";
import PageLayout from "../components/PageLayout";
import { IconChat } from "../components/Icons";

export default function ChatListPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

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
    } catch {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <PageLayout sidebar noFooter noHeader>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {busy ? (
          <div className="flex flex-col items-center gap-4 animate-fade-slide-up">
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
          <div className="text-center max-w-md animate-fade-slide-up">
            <div className="mb-4 flex justify-center"><IconChat size={48} /></div>
            <h1 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>Truthseekers Chat</h1>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--muted)" }}>
              Ask questions, explore topics, or request full encyclopedia articles.
            </p>
            <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto">
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
          </div>
        )}
      </div>
    </PageLayout>
  );
}
