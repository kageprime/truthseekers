"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { fetchArticle, progressUrl } from "@/lib/api";
import { BASE } from "@/lib/constants";
import { useQuota, useGenerateArticle, useRefreshArticle } from "../../hooks";
import PageLayout from "../../components/PageLayout";
import GenerationBar from "../../components/GenerationBar";
import BlockRenderer, { articleToBlocks } from "../../components/BlockRenderer";
import type { AgentEvent } from "../../components/ProcessViewer";
import type { Article } from "@encarta/core";
import { IconXCircle, IconBook, IconLightning, IconFile, IconFileText, IconUser, IconRefresh, IconAlert } from "../../components/Icons";

interface ArticleClientProps {
  slug: string;
  article: Article | null;
  isGenerating: boolean;
  initialPhase: string;
}

export default function ArticleClient({ slug, article: initialArticle, isGenerating, initialPhase }: ArticleClientProps) {
  const [article, setArticle] = useState<Article | null>(initialArticle);
  const [loading, setLoading] = useState(!initialArticle && !isGenerating);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(isGenerating);
  const [progress, setProgress] = useState(initialPhase);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [pausedError, setPausedError] = useState<string | undefined>(undefined);
  const { data: quota } = useQuota();
  const { mutate: generateArticle } = useGenerateArticle();
  const { mutate: refreshArticle } = useRefreshArticle();
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (slug && !trackedRef.current) {
      trackedRef.current = true;
      fetch(`${BASE}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, event: "view" }),
      }).catch(() => {});
    }
  }, [slug]);

  useEffect(() => {
    if (initialArticle || generating || isGenerating) return;
    setLoading(false);
  }, [slug, initialArticle, generating, isGenerating]);

  useEffect(() => {
    if (!generating || article) return;

    const es = new EventSource(progressUrl(slug));
    sseRef.current = es;

    es.addEventListener("agent_event", (e) => {
      try {
        const eventData: AgentEvent = JSON.parse(e.data);
        setAgentEvents((prev) => [...prev, eventData]);
      } catch { /* skip malformed events */ }
    });

    es.addEventListener("progress", (e) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(e.data); } catch { return; /* skip malformed */ }
      if (data.status === "done") {
        fetchArticle(slug).then((a) => {
          if (a) setArticle(a);
          setGenerating(false);
          es.close();
          sseRef.current = null;
        }).catch(() => { setGenerating(false); });
      } else if (data.status === "error") {
        setProgress(`Error: ${data.error}`);
        setGenerating(false);
        es.close();
        sseRef.current = null;
      } else if (data.status === "not_queued") {
        setGenerating(false);
        es.close();
        sseRef.current = null;
      } else {
        const phaseStr = data.status === "paused" ? "paused" : (typeof data.phase === "string" ? data.phase : typeof data.status === "string" ? data.status : "unknown");
        setProgress(phaseStr);
        if (data.status === "paused") {
          setPausedError(data.error as string);
        } else {
          setPausedError(undefined);
        }
      }
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [slug, generating, article]);

  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress("queued");
    setQuotaBlocked(false);
    try {
      const result = await generateArticle({ slug });
      if (result?.status === "already_exists") {
        try {
          const a = await fetchArticle(slug);
          if (a) setArticle(a);
        } catch { /* fetch failed — stay in generating state */ }
        setGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate article");
      setGenerating(false);
    }
  }, [slug, generateArticle]);

  const handleRefresh = useCallback(async () => {
    setGenerating(true);
    setProgress("queued");
    setQuotaBlocked(false);
    try {
      await refreshArticle(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh article");
      setGenerating(false);
    }
  }, [slug, refreshArticle]);

  const handleExport = useCallback((format: "json" | "markdown") => {
    if (!article) return;
    const url = `${BASE}/articles/${slug}/export?format=${format}`;
    window.open(url, "_blank");
  }, [article, slug]);

  if (error && !article) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-lg mx-auto text-center glass-card-static p-6 sm:p-10" style={{ background: "var(--cream)" }}>
            <div className="mb-5"><IconXCircle size={44} /></div>
            <h1 className="text-xs font-semibold mb-2" style={{ color: "var(--red)" }}>Error Loading Article</h1>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
              className="btn btn-primary"
            >
              Try Again
            </button>
            <div className="mt-4">
              <Link href="/" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
                ← Back to home
              </Link>
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[var(--border)] border-t-[var(--ink)]"
              style={{ animation: "spin 0.8s linear infinite" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--subtle)" }}>Loading...</span>
          </div>
        </main>
      </PageLayout>
    );
  }

  if (!article && !generating) {
    const atLimit = quota && quota.remaining <= 0;
    return (
      <PageLayout>
        <main className="flex-1 px-6 py-12 sm:py-16">
          <div className="max-w-lg mx-auto text-center glass-card-static p-6 sm:p-10" style={{ background: "var(--cream)" }}>
            <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center glass-card-static">
              {atLimit ? <IconAlert size={28} /> : <IconBook size={28} />}
            </div>
            <h1 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </h1>
            {atLimit ? (
              <>
                <p className="text-sm mb-3" style={{ color: "var(--red)" }}>Generation limit reached</p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--muted)" }}>
                  Your {quota.tier} plan allows {quota.limit} article generations. Upgrade to create more articles.
                </p>
                <Link href="/pricing" className="btn btn-primary btn-lg">
                  Upgrade Plan
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: "var(--subtle)" }}>Topic not yet generated</p>
                <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--muted)" }}>
                  The AI agent will research the web, outline the content, write a full article, and verify all citations.
                </p>
                <button
                  onClick={handleGenerate}
                  className="btn btn-primary btn-lg"
                >
                  <IconLightning size={18} /> Generate Encyclopedia Article
                </button>
                {quota && (
                  <p className="text-xs mt-4" style={{ color: "var(--subtle)" }}>
                    {quota.remaining} of {quota.limit} generations remaining ({quota.tier})
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </PageLayout>
    );
  }

  if (generating && !article) {
    const hasError = progress.startsWith("Error:");
    const progressEntry = {
      slug,
      title: slug.replace(/-/g, " "),
      phase: progress || "queued",
      error: hasError ? progress.replace("Error: ", "") : pausedError,
      agentEvents,
    };

    return (
      <PageLayout>
        <main className="flex-1 px-6 py-12 sm:py-16">
          <div className="max-w-lg mx-auto">
            <h1 className="text-xs font-semibold text-center mb-8 capitalize" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ")}
            </h1>
            <GenerationBar
              entry={progressEntry}
              onRetry={() => handleGenerate()}
              onDismiss={() => {}}
              showWatchLive={false}
            />
          </div>
        </main>
      </PageLayout>
    );
  }

  if (!article) return null;

  return (
    <PageLayout>
      <div className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>

        <article className="max-w-[42rem] mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {/* Back link */}
          <Link href="/chat/new" className="inline-flex items-center gap-1 dateline mb-8 transition-colors hover:underline" style={{ color: "var(--gold)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            The Encyclopedia
          </Link>

          {/* Admin / utility toolbar — demoted to a slim icon row */}
          <div className="flex items-center justify-end gap-1 mb-6 -mt-12 sm:-mt-16">
            <button
              onClick={handleRefresh}
              disabled={generating || (quota?.remaining != null && quota.remaining <= 0)}
              className="btn-icon btn-ghost"
              title={generating ? "Refreshing…" : "Regenerate article"}
              aria-label="Regenerate article"
            >
              <IconRefresh size={15} />
            </button>
            <button onClick={() => handleExport("json")} className="btn-icon btn-ghost" title="Export JSON" aria-label="Export JSON">
              <IconFile size={15} />
            </button>
            <button onClick={() => handleExport("markdown")} className="btn-icon btn-ghost" title="Export Markdown" aria-label="Export Markdown">
              <IconFileText size={15} />
            </button>
            {quota != null && quota.remaining <= 3 && (
              <span className="dateline ml-2" style={{ color: quota.remaining === 0 ? "var(--oxblood)" : "var(--gold)" }}>
                {quota.remaining}/{quota.limit} left
              </span>
            )}
          </div>

          {/* Title block */}
          <header className="mb-10 text-center">
            <h1 className="t-display mb-4" style={{ fontSize: "clamp(2rem, 1rem + 4vw, 3rem)", color: "var(--ink)" }}>
              {article.title || slug.replace(/-/g, " ")}
            </h1>
            {/* Gold rule under the title */}
            <div className="mx-auto" style={{ height: 2, width: "3rem", background: "var(--gold)" }} />

            {/* Dateline — small-caps meta */}
            <div className="dateline mt-4" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 0.25em" }}>
              <span>Vol. I</span>
              {article.metadata?.version != null && (<>
                <span className="sep">·</span><span>Rev. {article.metadata.version}</span>
              </>)}
              {article.metadata?.updated && (<>
                <span className="sep">·</span>
                <span>{new Date(article.metadata.updated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
              </>)}
              {article.metadata?.generatedBy && (<>
                <span className="sep">·</span>
                <span><IconUser size={11} /> {article.metadata.generatedBy.slice(0, 12)}</span>
              </>)}
            </div>
          </header>

          {/* Article body — reading column */}
          <div className="reading-column">
            {article.blocks && article.blocks.length > 0 ? (
              <BlockRenderer blocks={article.blocks} />
            ) : (
              <BlockRenderer blocks={articleToBlocks(
                article.slug,
                article.title,
                article.abstract,
                article.sections,
                article.timeline,
                article.crossrefs,
                article.citations,
              )} />
            )}
          </div>
        </article>
      </div>
    </PageLayout>
  );
}
