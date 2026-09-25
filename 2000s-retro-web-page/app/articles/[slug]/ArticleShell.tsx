"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClaimText } from "@/components/claim-text";
import { ClaimGraph } from "@/components/claim-graph";
import { GapRow } from "@/components/gap-row";
import { SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/components/auth-provider";
import {
  contestArticle,
  exportArticleUrl,
  generateArticle,
  progressUrl,
  refreshArticle,
  trackView,
} from "@/lib/api";
import type { Article, Claim, Gap, MediaItem } from "@/lib/types";

// ponytail: one figure — captioned, AI-badged per the photo-scoring contract,
// self-removing when the file is gone (local dev has no /images files).
function ArticleFigure({ media }: { media: MediaItem }) {
  const [dead, setDead] = useState(false);
  if (!media.src || dead) return null;
  const ai = (media.source ?? "") === "ai-generated";
  return (
    <figure className="mt-8 border border-ink/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.src}
        alt={media.caption || "Article illustration"}
        loading="lazy"
        onError={() => setDead(true)}
        className="aspect-[16/8] w-full object-cover"
      />
      {(media.caption || ai) && (
        <figcaption className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-[10px] uppercase text-muted">
          <span>{media.caption}</span>
          {ai && <span className="shrink-0 text-coral">✦ AI Visual Reconstruction</span>}
        </figcaption>
      )}
    </figure>
  );
}

interface Epistemic {
  claims: Claim[];
  gaps: Gap[];
  freshness: { overall_score: number } | null;
}

// ponytail: missing articles get one action — queue generation, then
// listen for completion. Anon goes to login instead of a dead button.
export function MissingArticle({ slug, generating, phase }: { slug: string; generating: boolean; phase: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [livePhase, setLivePhase] = useState(phase);

  useEffect(() => {
    if (!generating) return;
    const src = new EventSource(progressUrl(slug), { withCredentials: true });
    src.addEventListener("progress", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        if (d.phase) setLivePhase(d.phase);
      } catch {
        /* heartbeat */
      }
    });
    src.addEventListener("article_complete", () => {
      src.close();
      router.refresh();
    });
    return () => src.close();
  }, [slug, generating, router]);

  const queue = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/articles/${slug}`)}`);
      return;
    }
    setBusy(true);
    await generateArticle(slug).catch(() => null);
    setBusy(false);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[1400px] border-x border-ink/10 px-5 py-20 md:px-12">
        <Link href="/articles" className="flex items-center gap-2 font-mono text-[10px] uppercase">
          <ArrowLeft size={13} /> Back to reading room
        </Link>
        <h1 className="mt-10 font-sans text-6xl font-bold leading-[.86] tracking-[-.08em] md:text-8xl">
          Not yet<br />
          <span className="text-coral">written.</span>
        </h1>
        <p className="mt-8 max-w-md font-serif text-xl">
          No article at <span className="font-mono text-base">{slug}</span>
          {generating || livePhase ? (
            <>
              {" "}— Veritas is writing it now{livePhase ? ` (${livePhase})` : ""}. This page refreshes on
              completion.
            </>
          ) : (
            " — queue it and Veritas will research and write it."
          )}
        </p>
        {!generating && (
          <button
            disabled={busy}
            onClick={queue}
            className="mt-8 bg-coral px-5 py-3 font-mono text-[10px] uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-40"
          >
            {busy ? "Queueing…" : user ? "Generate article" : "Log in to generate"}
          </button>
        )}
      </div>
    </main>
  );
}

function headline(title: string) {
  const words = title.split(" ");
  if (words.length < 2) return { head: title, tail: "" };
  const cut = Math.ceil(words.length / 2);
  return { head: words.slice(0, cut).join(" "), tail: words.slice(cut).join(" ") };
}

export function ArticleShell({
  slug,
  article,
  epistemic,
  isGenerating,
  initialPhase,
}: {
  slug: string;
  article: Article;
  epistemic: Epistemic;
  isGenerating: boolean;
  initialPhase: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [chapter, setChapter] = useState(article.sections[0]?.title ?? "Overview");
  const [phase, setPhase] = useState(initialPhase);
  const [busy, setBusy] = useState(false);
  const [argument, setArgument] = useState("");
  const [contestMsg, setContestMsg] = useState<string | null>(null);

  // ponytail: generating pages listen for completion, then revalidate.
  useEffect(() => {
    if (!isGenerating) return;
    const src = new EventSource(progressUrl(slug), { withCredentials: true });
    src.addEventListener("progress", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        if (d.phase) setPhase(d.phase);
      } catch {
        /* heartbeat */
      }
    });
    src.addEventListener("article_complete", () => {
      src.close();
      router.refresh();
    });
    return () => src.close();
  }, [slug, isGenerating, router]);

  // ponytail: fire-and-forget view event so .../views has data to show.
  useEffect(() => {
    trackView(slug);
  }, [slug]);

  const chapters = [
    ...article.sections.map((s) => s.title),
    ...(article.timeline.length ? ["Timeline"] : []),
    ...(epistemic.claims.length ? ["Claims"] : []),
    ...(article.citations.length ? ["Sources"] : []),
  ];
  const { head, tail } = headline(article.title);
  const pullquote = epistemic.claims.find((c) => c.status === "supported")?.text;
  const hero = article.sections.flatMap((s) => s.media ?? []).find((m) => m.type === "image" && m.src);
  const heroSrc = hero?.src ?? null;
  const kicker = article.categories.join(" / ") || "Article";

  const runWrite = async (fn: () => Promise<unknown>) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/articles/${slug}`)}`);
      return;
    }
    setBusy(true);
    await fn().catch(() => null);
    setBusy(false);
    router.refresh();
  };

  const submitContest = async () => {
    if (!argument.trim()) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/articles/${slug}`)}`);
      return;
    }
    setBusy(true);
    const r = await contestArticle(slug, argument.trim());
    setBusy(false);
    setContestMsg(
      r.status === "queued"
        ? "Challenge upheld — regeneration queued."
        : r.reasoning || r.error || "Recorded."
    );
    if (r.status === "queued") {
      setArgument("");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div id="top" className="mx-auto grid max-w-[1400px] border-x border-ink/10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-ink/10 lg:block">
          <div className="sticky top-0 p-6">
            <Link href="/articles" className="flex items-center gap-2 font-mono text-[10px] uppercase">
              <ArrowLeft size={13} /> Back to index
            </Link>
            <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Article / {kicker}
            </p>
            <nav aria-label="Chapters" className="mt-8 space-y-3">
              {chapters.map((item, i) => (
                <button
                  key={item}
                  onClick={() => setChapter(item)}
                  className={`block text-left font-mono text-[10px] uppercase ${
                    chapter === item ? "text-coral" : "text-muted hover:text-ink"
                  }`}
                >
                  0{i + 1} / {item}
                </button>
              ))}
            </nav>
            <div className="mt-20 border-t border-ink/15 pt-4 font-mono text-[10px] uppercase leading-relaxed text-muted">
              Updated {article.metadata.updated.slice(0, 10)}
              <br />
              Confidence {Math.round((article.derived_confidence ?? 0) * 100)}%
              {phase && (
                <>
                  <br />
                  <span className="text-coral">● {phase}</span>
                </>
              )}
            </div>
            <div className="mt-6 space-y-2">
              <button
                disabled={busy}
                onClick={() => runWrite(() => refreshArticle(slug))}
                className="w-full border border-ink/25 px-3 py-2 font-mono text-[10px] uppercase hover:border-coral hover:text-coral disabled:opacity-40"
              >
                {busy ? "Working…" : "Refresh"}
              </button>
              <a
                href={exportArticleUrl(slug)}
                download
                className="block border border-ink/25 px-3 py-2 text-center font-mono text-[10px] uppercase hover:border-coral hover:text-coral"
              >
                Export .md
              </a>
              {!user && (
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/articles/${slug}`)}`}
                  className="block border border-coral px-3 py-2 text-center font-mono text-[10px] uppercase text-coral"
                >
                  Log in to write
                </Link>
              )}
            </div>
          </div>
        </aside>

        <article id="article" className="min-w-0">
          <section className="border-b border-ink/10 px-5 py-12 md:px-12 md:py-20">
            <div className="mb-8 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <span>{kicker}</span>
              <span>Confidence {Math.round((article.derived_confidence ?? 0) * 100)}%</span>
              {epistemic.freshness && <span>Freshness {epistemic.freshness.overall_score.toFixed(2)}</span>}
            </div>
            <h1 className="max-w-5xl font-sans text-6xl font-bold leading-[.86] tracking-[-.085em] md:text-[9rem]">
              {head}
              {tail && (
                <>
                  <br />
                  <span className="text-coral">{tail}</span>
                </>
              )}
            </h1>
            <p className="mt-10 max-w-2xl font-serif text-2xl leading-[1.2] md:text-3xl">
              <ClaimText text={article.abstract} />
            </p>
            {hero && <ArticleFigure media={hero} />}
          </section>

          {article.sections.map((s, i) => (
            <section
              key={s.id}
              className="grid gap-10 border-b border-ink/10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20"
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">{chapter}</p>
                <h2 className="mt-3 font-sans text-4xl font-bold tracking-[-.06em] md:text-6xl">{s.title}</h2>
              </div>
              <div className="space-y-6 font-serif text-lg leading-relaxed">
                <p>
                  <ClaimText text={s.content} />
                </p>
                {(s.media ?? [])
                  .filter((m) => m.type === "image" && m.src && m.src !== heroSrc)
                  .slice(0, 2)
                  .map((m, j) => (
                    <ArticleFigure key={m.id ?? `${s.id}-img-${j}`} media={m} />
                  ))}
                {i === 0 && pullquote && (
                  <blockquote className="border-l-4 border-coral py-2 pl-6 font-serif text-2xl leading-tight">
                    “{pullquote}”
                  </blockquote>
                )}
              </div>
            </section>
          ))}

          {article.timeline.length > 0 && (
            <section id="timeline" className="grid gap-10 border-b border-ink/10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">A short history</p>
                <h2 className="mt-3 font-sans text-4xl font-bold tracking-[-.06em] md:text-6xl">What happened.</h2>
              </div>
              <div className="divide-y divide-ink/15 border-y border-ink/15">
                {article.timeline.map((t, i) => (
                  <div key={i} className="grid gap-3 py-6 md:grid-cols-[110px_1fr]">
                    <span className="font-mono text-xs text-coral">{String(t.year)}</span>
                    <div>
                      <h3 className="font-serif text-2xl">{t.event}</h3>
                      {t.description && (
                        <p className="mt-2 max-w-xl font-serif text-sm leading-relaxed text-muted">{t.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {epistemic.claims.length > 0 && (
            <section id="claims" className="grid gap-10 border-b border-ink/10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">
                  Traverse / {epistemic.claims.length}
                </p>
                <h2 className="mt-3 font-sans text-4xl font-bold tracking-[-.06em] md:text-6xl">
                  Don&apos;t just believe.
                </h2>
              </div>
              <div className="space-y-3">
                {epistemic.claims.slice(0, 12).map((c) => (
                  <div key={c.id} className="border border-ink/15 p-4">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase text-muted">
                      <span>{c.id.slice(0, 8)}</span>
                      <span>{c.status}</span>
                    </div>
                    <p className="mt-2 font-serif text-base leading-relaxed">{c.text}</p>
                  </div>
                ))}
                {epistemic.gaps.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="font-mono text-[10px] uppercase text-muted">
                      Open gaps / {epistemic.gaps.length}
                    </p>
                    {epistemic.gaps.slice(0, 6).map((g) => (
                      <GapRow key={g.id} gap={g} />
                    ))}
                  </div>
                )}
                <ClaimGraph slug={slug} />
              </div>
            </section>
          )}

          <section className="grid gap-10 border-b border-ink/10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Challenge</p>
              <h2 className="mt-3 font-sans text-4xl font-bold tracking-[-.06em] md:text-6xl">Disagree?</h2>
            </div>
            <div>
              <label htmlFor="contest" className="font-mono text-[10px] uppercase text-muted">
                State what&apos;s wrong and what would change it
              </label>
              <textarea
                id="contest"
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
                rows={4}
                className="mt-2 w-full border border-ink/25 bg-transparent p-4 font-serif text-base outline-none placeholder:text-muted focus:border-coral"
                placeholder="The article claims…, but…"
              />
              <button
                disabled={busy || !argument.trim()}
                onClick={submitContest}
                className="mt-4 bg-coral px-5 py-3 font-mono text-[10px] uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-40"
              >
                {busy ? "Judging…" : "Submit challenge"}
              </button>
              {contestMsg && <p className="mt-3 font-serif text-base">{contestMsg}</p>}
            </div>
          </section>

          {article.citations.length > 0 && (
            <section id="sources" className="grid gap-10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Further reading</p>
                <h2 className="mt-3 font-sans text-4xl font-bold tracking-[-.06em] md:text-6xl">
                  Keep
                  <br />
                  looking.
                </h2>
              </div>
              <div className="space-y-3">
                {article.citations.map((c, i) => (
                  <a
                    key={c.url}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between border-b border-ink/15 py-4 font-serif text-xl hover:text-coral"
                  >
                    <span>
                      <span className="mr-4 font-mono text-[10px] text-muted">0{i + 1}</span>
                      {c.title || c.url}
                    </span>
                    <ArrowUpRight size={18} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {article.crossrefs.length > 0 && (
            <section className="grid gap-10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Related entries</p>
                <h2 className="mt-3 font-sans text-4xl font-bold tracking-[-.06em] md:text-6xl">
                  Follow
                  <br />
                  the thread.
                </h2>
              </div>
              <div className="space-y-3">
                {article.crossrefs.map((c) => (
                  <Link
                    key={c.id}
                    href={`/articles/${c.id}`}
                    className="group flex items-center justify-between border-b border-ink/15 py-4 hover:text-coral"
                  >
                    <span>
                      <span className="block font-serif text-xl">{c.title}</span>
                      {c.relationship && (
                        <span className="mt-1 block font-mono text-[10px] uppercase text-muted">
                          {c.relationship}
                        </span>
                      )}
                    </span>
                    <ArrowUpRight size={18} className="shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
      <SiteFooter tone="coral">
        <a href="#top" className="underline">
          Back to top ↑
        </a>
        <br />
        <a href="#sources" className="underline">
          Cite this article ↗
        </a>
      </SiteFooter>
    </main>
  );
}
