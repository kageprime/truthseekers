"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useCreateChat, useArticles } from "./hooks";
import PageLayout from "./components/PageLayout";
import ArticleCard from "./components/ArticleCard";
import Fleuron from "./components/editorial/Fleuron";
import PullQuote from "./components/editorial/PullQuote";
import { CATEGORIES, default as CategoryIcon } from "./components/editorial/CategoryIcon";
import type { ArticleSummary } from "@encarta/core";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState("");
  const { mutate: createChat, loading: busy } = useCreateChat();

  // Featured + recent articles. `useArticles` caches via react-query.
  const { data: articlesResp } = useArticles(0, 12);
  const articles: ArticleSummary[] = useMemo(
    () => (articlesResp as any)?.data ?? [],
    [articlesResp],
  );
  const featured = articles[0] ?? null;
  const recent = articles.slice(1, 7);

  // Real category counts derived from loaded articles.
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of articles) for (const c of a.categories ?? []) m[c] = (m[c] ?? 0) + 1;
    return m;
  }, [articles]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const query = input.trim();
    const conv = await createChat(query);
    if (conv) router.push(`/chat/${conv.id}?q=${encodeURIComponent(query)}`);
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center py-24" style={{ background: "var(--surface)", position: "relative", zIndex: 1 }}>
        <div className="w-8 h-8 rounded-full border-3 animate-spin"
          style={{ borderColor: "var(--rule)", borderTopColor: "var(--gold)" }} />
      </main>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <PageLayout>
      <main style={{ background: "var(--surface)", position: "relative", zIndex: 1 }}>
        {/* ── Masthead hero ─────────────────────────────────────── */}
        <section className="px-6 pt-16 pb-10 text-center max-w-3xl mx-auto animate-fade-slide-up">
          <div className="dateline mb-3" style={{ letterSpacing: "0.14em" }}>
            {today} · Vol. I · The Living Edition
          </div>
          <h1 className="t-display mb-3" style={{ fontSize: "clamp(2.5rem, 1rem + 6vw, 4rem)", color: "var(--ink)" }}>
            Truthseekers
          </h1>
          <div className="mx-auto mb-4" style={{ height: 2, width: "3.5rem", background: "var(--gold)" }} />
          <p className="font-serif italic mb-8" style={{ fontSize: "1.15rem", color: "var(--muted)" }}>
            The Living Encyclopedia
          </p>

          {/* Single prominent search / ask bar */}
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search or ask about any topic…"
                className="input flex-1 text-base py-3.5 px-5"
                style={{ fontFamily: "var(--font-serif)", borderRadius: "var(--radius)" }}
                autoFocus
              />
              <button type="submit" disabled={!input.trim() || busy} className="btn btn-primary btn-lg shrink-0 px-6">
                {busy ? "Asking…" : "Ask"}
              </button>
            </div>
          </form>

          {/* Trust strip — collapsed explainer */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 dateline" style={{ fontSize: "0.7rem" }}>
            <span><span style={{ color: "var(--gold)" }}>✦</span> Researched</span>
            <span style={{ color: "var(--rule)" }}>·</span>
            <span><span style={{ color: "var(--gold)" }}>✦</span> Written</span>
            <span style={{ color: "var(--rule)" }}>·</span>
            <span><span style={{ color: "var(--gold)" }}>✦</span> Verified</span>
            <span style={{ color: "var(--rule)" }}>·</span>
            <span><span style={{ color: "var(--gold)" }}>✦</span> Illustrated</span>
          </div>

          {!user && (
            <p className="mt-6 text-xs" style={{ color: "var(--subtle)" }}>
              <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--gold)" }}>Sign in</Link> to generate and save articles.
            </p>
          )}
        </section>

        <div className="max-w-4xl mx-auto px-6"><Fleuron /></div>

        {/* ── Category browser — the table of contents ─────────── */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <SectionLabel>Browse the Encyclopedia</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-6">
            {CATEGORIES.map((cat) => {
              const n = counts[cat.slug] ?? 0;
              return (
                <Link
                  key={cat.slug}
                  href={`/articles?cat=${encodeURIComponent(cat.slug)}`}
                  className="plate p-4 flex flex-col items-center text-center no-underline group"
                  style={{ color: "inherit" }}
                >
                  <span style={{ color: "var(--gold)", transition: "transform 0.3s cubic-bezier(0.23,1,0.32,1)" }} className="group-hover:-translate-y-0.5 inline-flex">
                    <CategoryIcon slug={cat.slug} size={26} />
                  </span>
                  <span className="font-display text-sm mt-2" style={{ color: "var(--ink)" }}>{cat.label}</span>
                  <span className="dateline mt-1" style={{ fontSize: "0.65rem" }}>
                    {n > 0 ? `${n} ${n === 1 ? "entry" : "entries"}` : "Coming soon"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Featured + recent ─────────────────────────────────── */}
        {(featured || recent.length > 0) && (
          <section className="max-w-5xl mx-auto px-6 py-10">
            <SectionLabel>Featured &amp; Recent</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {featured && (
                <div className="lg:col-span-2">
                  <ArticleCard article={featured} />
                </div>
              )}
              {recent.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="see-also mb-1">
                    <span className="see-also-label">Recently added</span>
                  </div>
                  {recent.slice(0, 4).map((a) => (
                    <Link key={a.slug} href={`/article/${a.slug}`} className="no-underline" style={{ color: "inherit" }}>
                      <div className="py-2" style={{ borderBottom: "1px solid var(--rule)" }}>
                        <div className="font-display text-sm leading-snug" style={{ color: "var(--ink)" }}>{a.title}</div>
                        <div className="font-serif text-xs italic line-clamp-1" style={{ color: "var(--muted)" }}>{a.abstract}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 text-center">
              <Link href="/articles" className="btn btn-secondary">Browse all articles →</Link>
            </div>
          </section>
        )}

        {/* ── One Good Fact (static, graceful fallback) ─────────── */}
        <section className="max-w-3xl mx-auto px-6 py-12">
          <SectionLabel>One Good Fact</SectionLabel>
          <div className="mt-6">
            <PullQuote cite="Truthseekers">
              The word &ldquo;encyclopedia&rdquo; comes from the Greek <em>enkyklios paideia</em> — literally &ldquo;a circle of learning,&rdquo; the complete course of general education a free person was expected to pursue.
            </PullQuote>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-6"><Fleuron /></div>

        {/* ── Footer sign-in (discreet) ─────────────────────────── */}
        {!user && (
          <section className="text-center py-12 px-6">
            <p className="font-serif italic" style={{ color: "var(--muted)" }}>
              Every entry here is researched, written, and verified by AI agents.
            </p>
            <Link href="/login" className="btn btn-ghost mt-3" style={{ color: "var(--gold)" }}>
              Sign in to begin →
            </Link>
          </section>
        )}
      </main>
    </PageLayout>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="dateline" style={{ color: "var(--gold)", fontSize: "0.72rem" }}>{children}</span>
      <span className="flex-1" style={{ height: 1, background: "var(--rule)" }} />
    </div>
  );
}
