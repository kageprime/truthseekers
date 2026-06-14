"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { fetchArticle, generateArticle, refreshArticle, progressUrl, BASE } from "@/lib/api";
import PageLayout from "../../components/PageLayout";
import PageTitleBar from "../../components/PageTitleBar";
import GenerationBar from "../../components/GenerationBar";
import BlockRenderer, { articleToBlocks } from "../../components/BlockRenderer";
import type { AgentEvent } from "../../components/ProcessViewer";
import type { Article } from "@encarta/core";

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
    // SSR already checked everything — no need for client-side re-fetch
    if (initialArticle || generating || isGenerating) return;
    // Article truly doesn't exist and isn't generating — show "not generated" UI
    setLoading(false);
  }, [slug, initialArticle, generating, isGenerating]);

  useEffect(() => {
    if (!generating || article) return;

    const es = new EventSource(progressUrl(slug));
    sseRef.current = es;

    es.addEventListener("agent_event", (e) => {
      const eventData: AgentEvent = JSON.parse(e.data);
      setAgentEvents((prev) => [...prev, eventData]);
    });

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      if (data.status === "done") {
        fetchArticle(slug).then((a) => {
          if (a) setArticle(a);
          setGenerating(false);
          es.close();
          sseRef.current = null;
        });
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
        setProgress(data.phase || data.status);
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
        const a = await fetchArticle(slug);
        if (a) setArticle(a);
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

  // Error state
  if (error && !article) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg text-center">
            <div className="text-6xl mb-6">❌</div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--red)" }}>Error Loading Article</h1>
            <p className="text-sm mb-6" style={{ color: "#5f6368" }}>{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
              className="btn-primary"
            >
              Try Again
            </button>
            <div className="mt-4">
              <Link href="/" className="text-sm hover:underline" style={{ color: "#5f6368" }}>
                ← Back to home
              </Link>
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  // Loading
  if (loading) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center">
          <div className="inline-block w-8 h-8 border-4 border-[#e0e0e0] border-t-[#1a1a1a] rounded-full"
            style={{ animation: "spin 0.8s linear infinite" }} />
        </main>
      </PageLayout>
    );
  }

  // Not generated yet
  if (!article && !generating) {
    return (
      <PageLayout>
        <main className="flex-1 px-6 py-12 sm:py-16">
          <div className="max-w-lg mx-auto text-center pixel-card p-6 sm:p-10" style={{ background: "var(--cream)" }}>
            <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center text-3xl pixel-card-sm" style={{ background: "white" }}>
              📖
            </div>
            <h1 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </h1>
            <p className="text-sm mb-6" style={{ color: "#9aa0a6" }}>Topic not yet generated</p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "#5f6368" }}>
              The AI agent will research the web, outline the content, write a full article, and verify all citations.
            </p>
            <button
              onClick={handleGenerate}
              className="btn-primary btn-lg"
            >
              ⚡ Generate Encyclopedia Article
            </button>
          </div>
        </main>
      </PageLayout>
    );
  }

  // Generating
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
            <h1 className="pixel text-xs text-center mb-8 capitalize" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ")}
            </h1>
            <GenerationBar
              entry={progressEntry}
              onRetry={() => handleGenerate()}
              onDismiss={() => { /* noop */ }}
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

      {/* Article action bar */}
      <PageTitleBar>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "#9aa0a6" }}>v{article.metadata.version}</span>
          <span className="text-xs" style={{ color: "#9aa0a6" }}>·</span>
          <span className="text-xs" style={{ color: "#9aa0a6" }}>
            {new Date(article.metadata.updated).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric"
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={generating}
            className="btn-primary btn-sm"
          >
            {generating ? "Refreshing..." : "↻ Refresh"}
          </button>
          <button
            onClick={() => handleExport("json")}
            className="btn-secondary btn-sm"
          >
            JSON
          </button>
          <button
            onClick={() => handleExport("markdown")}
            className="btn-secondary btn-sm"
          >
            MD
          </button>
        </div>
      </PageTitleBar>

      <article className="max-w-6xl mx-auto px-6 py-10">
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
      </article>
      </div>
    </PageLayout>
  );
}
