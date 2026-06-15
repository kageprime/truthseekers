"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { fetchArticle, generateArticle, refreshArticle, progressUrl, BASE } from "@/lib/api";
import PageLayout from "../../components/PageLayout";
import GenerationBar from "../../components/GenerationBar";
import BlockRenderer, { articleToBlocks } from "../../components/BlockRenderer";
import type { AgentEvent } from "../../components/ProcessViewer";
import type { Article } from "@encarta/core";
import { IconXCircle, IconBook, IconLightning, IconFile, IconFileText, IconUser, IconRefresh } from "../../components/Icons";

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
        const phaseStr = typeof data.phase === "string" ? data.phase : typeof data.status === "string" ? data.status : "unknown";
        setProgress(phaseStr);
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
    try {
      const result = await generateArticle(slug);
      if (result.status === "already_exists") {
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
  }, [slug]);

  const handleRefresh = useCallback(async () => {
    setGenerating(true);
    setProgress("queued");
    try {
      await refreshArticle(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh article");
      setGenerating(false);
    }
  }, [slug]);

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
    return (
      <PageLayout>
        <main className="flex-1 px-6 py-12 sm:py-16">
          <div className="max-w-lg mx-auto text-center glass-card-static p-6 sm:p-10" style={{ background: "var(--cream)" }}>
            <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center glass-card-static">
              <IconBook size={28} />
            </div>
            <h1 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </h1>
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
      error: hasError ? progress.replace("Error: ", "") : undefined,
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
      <div className="flex-1 overflow-y-auto">

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Back to articles */}
          <Link href="/articles" className="inline-flex items-center gap-1 text-sm mb-4 transition-colors hover:underline" style={{ color: "var(--accent)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Articles
          </Link>

          {/* Meta bar */}
          <div className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--subtle)", fontFamily: "var(--font-mono)" }}>
            <span>v{article.metadata.version}</span>
            <span>·</span>
            <span>{new Date(article.metadata.updated).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric"
            })}</span>
            {article.metadata.generatedBy && (
              <>
                <span>·</span>
                <span><IconUser size={12} /> {article.metadata.generatedBy.slice(0, 12)}...</span>
              </>
            )}
          </div>

          {/* Title */}
          <h1 className="text-lg sm:text-xl font-semibold mb-6 leading-tight" style={{ color: "var(--ink)" }}>
            {article.title || slug.replace(/-/g, " ")}
          </h1>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={handleRefresh}
              disabled={generating}
              className="btn btn-primary btn-sm"
            >
              {generating ? <><IconRefresh size={14} /> Refreshing...</> : <><IconRefresh size={14} /> Refresh</>}
            </button>
            <button
              onClick={() => handleExport("json")}
              className="btn btn-secondary btn-sm"
            >
              <IconFile size={14} /> JSON
            </button>
            <button
              onClick={() => handleExport("markdown")}
              className="btn btn-secondary btn-sm"
            >
              <IconFileText size={14} /> MD
            </button>
          </div>

          {/* Article content */}
          <div className="glass-card-static p-4 sm:p-8">
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
        </div>
      </div>
    </PageLayout>
  );
}
