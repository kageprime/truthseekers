"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchArticle, generateArticle, refreshArticle, progressUrl, BASE } from "@/lib/api";
import PageLayout from "../../components/PageLayout";
import MermaidDiagram from "../../components/MermaidDiagram";
import InteractiveTimeline from "../../components/InteractiveTimeline";
import GenerationBar from "../../components/GenerationBar";
import type { AgentEvent } from "../../components/ProcessViewer";
import { SkeletonImage, BlankSlateImage, BlankSlateMedia, FigureImage } from "../../components/MediaImage";
import { sanitizeHTML } from "@/lib/markdown";
import type { Article, MediaItem } from "@encarta/core";

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

  const sectionColors = [
    { bg: "#fef3c7", accent: "#f59e0b" },
    { bg: "#e0f2fe", accent: "#0284c7" },
    { bg: "#dcfce7", accent: "#22c55e" },
    { bg: "#fae8ff", accent: "#a21caf" },
    { bg: "#fff7ed", accent: "#ea580c" },
    { bg: "#fce7f3", accent: "#ec4899" },
    { bg: "#f0fdf4", accent: "#16a34a" },
    { bg: "#eff6ff", accent: "#2563eb" },
  ];

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
              className="pixel-btn"
              style={{ background: "var(--orange)", color: "white" }}
            >
              Try Again
            </button>
            <div className="mt-4">
              <a href="/" className="text-sm hover:underline" style={{ color: "#5f6368" }}>
                ← Back to home
              </a>
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
        <div className="px-6 py-12 sm:py-16">
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
              className="pixel-btn"
              style={{ background: "var(--orange)", color: "white", border: "2px solid var(--ink)" }}
            >
              ⚡ Generate Encyclopedia Article
            </button>
          </div>
        </div>
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
        <div className="px-6 py-12 sm:py-16">
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
        </div>
      </PageLayout>
    );
  }

  if (!article) return null;

  return (
    <PageLayout>

      {/* Article action bar */}
      <div className="border-b px-6 py-3" style={{ borderColor: "#dadce0", background: "white" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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
              className="pixel-btn text-[8px]"
              style={{ background: "var(--orange)", color: "white", border: "2px solid var(--ink)" }}
            >
              {generating ? "Refreshing..." : "↻ Refresh"}
            </button>
            <button
              onClick={() => handleExport("json")}
              className="pixel-btn text-[8px]"
              style={{ background: "white" }}
            >
              JSON
            </button>
            <button
              onClick={() => handleExport("markdown")}
              className="pixel-btn text-[8px]"
              style={{ background: "white" }}
            >
              MD
            </button>
          </div>
        </div>
      </div>

      <article className="max-w-6xl mx-auto px-6 py-10 prose">
        {/* Title Card */}
        <div className="pixel-card p-4 sm:p-8 md:p-10 mb-10 bg-white">
          <h1 className="pixel text-xl md:text-2xl mb-4 leading-snug" style={{ color: "var(--ink)" }}>
            {article.title}
          </h1>
          <div className="p-5 mb-0" style={{ background: "var(--cream)", border: "3px solid var(--ink)" }}>
            <p className="text-lg font-medium leading-relaxed m-0" style={{ color: "var(--ink)" }}>
              {article.abstract}
            </p>
          </div>
        </div>

        {/* Sections */}
        {article.sections.map((section, i) => {
          const palette = sectionColors[i % sectionColors.length];
          return (
            <div key={section.id || i} className="pixel-card p-4 sm:p-6 md:p-8 mb-6 bg-white">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 flex items-center justify-center text-xl shrink-0 border-2 border-black"
                  style={{ background: palette.bg }}>
                  {i + 1}
                </div>
                <div>
                  <h2 className="pixel text-sm mb-2" style={{ color: "var(--ink)" }}>
                    {section.title}
                  </h2>
                  <div className="h-1 w-12" style={{ background: palette.accent }} />
                </div>
              </div>
              <div
                className="leading-relaxed text-[1.05rem] overflow-x-auto break-words"
                style={{ color: "#222" }}
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(section.content) }}
              />
              {section.media && section.media.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {section.media.map((m: MediaItem, mi: number) => {
                    if (m.type === "diagram" && m.code) {
                      return <MermaidDiagram key={m.id || `media-${mi}`} code={m.code} caption={m.caption} />;
                    }
                    if (m.type === "image") {
                      if (m.src) {
                        return <FigureImage key={m.id || `media-${mi}`} src={m.src} caption={m.caption} source={m.source} />;
                      }
                      if (m.prompt) {
                        return <SkeletonImage key={m.id || `media-${mi}`} caption={m.caption} />;
                      }
                      return <BlankSlateImage key={m.id || `media-${mi}`} caption={m.caption} prompt={m.prompt} />;
                    }
                    if (m.type === "threed") {
                      return (
                        <div key={m.id || `media-${mi}`} className="pixel-card-sm p-3" style={{ background: "#f0f0ff" }}>
                          <span className="pixel text-[9px]" style={{ color: "#888" }}>3D SCENE</span>
                          <div className="h-32 flex items-center justify-center text-4xl bg-white/50 my-2 border border-dashed border-black/20">
                            <span className="text-2xl opacity-50">🧊</span>
                          </div>
                          <p className="text-sm">{m.caption}</p>
                          {m.code && (
                            <details className="mt-1">
                              <summary className="text-xs cursor-pointer" style={{ color: "#888" }}>scene code</summary>
                              <pre className="text-xs mt-1 p-2 bg-white border overflow-auto max-h-32">{m.code}</pre>
                            </details>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={m.id || `media-${mi}`} className="pixel-card-sm px-4 py-3 flex items-center gap-3"
                        style={{ background: palette.bg }}>
                        <span className="pixel text-[9px]" style={{ color: "#888" }}>[{m.type.toUpperCase()}]</span>
                        <span className="text-sm">{m.caption}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <BlankSlateMedia />
              )}
            </div>
          );
        })}

        {/* Timeline */}
        {article.timeline.length > 0 && (
          <InteractiveTimeline events={article.timeline} />
        )}

        {/* Sources */}
        {article.citations.length > 0 && (
          <div className="pixel-card p-4 sm:p-6 md:p-8 mb-6 bg-white">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">📚</span>
              <div>
                <h2 className="pixel text-sm" style={{ color: "var(--ink)" }}>SOURCES</h2>
                <div className="h-1 w-12 mt-1" style={{ background: "var(--green)" }} />
              </div>
            </div>
            <ol className="space-y-3 pl-0" style={{ listStyle: "none" }}>
              {article.citations.map((cite, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="pixel text-xs shrink-0 mt-0.5" style={{ color: "#888" }}>[{i + 1}]</span>
                  <div className="min-w-0">
                    <a href={cite.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[#ea580c] break-all"
                      style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                      {cite.title}
                    </a>
                    {cite.relevance && (
                      <span className="text-xs ml-2" style={{ color: "#888" }}>— {cite.relevance}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* See Also */}
        {article.crossrefs.length > 0 && (
          <div className="pixel-card p-4 sm:p-6 md:p-8 mb-6" style={{ background: "#fae8ff" }}>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">🔗</span>
              <div>
                <h2 className="pixel text-sm" style={{ color: "var(--ink)" }}>SEE ALSO</h2>
                <div className="h-1 w-12 mt-1" style={{ background: "var(--purple)" }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {article.crossrefs.map((ref, i) => (
                <a key={ref.id || i} href={`/article/${ref.id}`}
                  className="pixel-card-sm px-4 py-3 sm:py-2"
                  style={{ background: "white", textDecoration: "none", color: "var(--ink)", fontSize: "0.9rem" }}>
                  <span className="text-xs mr-2" style={{ color: "#888" }}>[{ref.relationship}]</span>
                  {ref.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </article>
    </PageLayout>
  );
}
