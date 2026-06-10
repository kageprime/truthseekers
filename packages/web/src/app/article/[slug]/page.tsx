"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchArticle, fetchArticleStatus, generateArticle, refreshArticle, progressUrl } from "@/lib/api";
import MermaidDiagram from "../../components/MermaidDiagram";
import InteractiveTimeline from "../../components/InteractiveTimeline";
import GenerationBar from "../../components/GenerationBar";
import QueueIndicator from "../../components/QueueIndicator";

interface Article {
  slug: string;
  title: string;
  abstract: string;
  sections: Section[];
  timeline: TimelineEvent[];
  crossrefs: CrossRef[];
  citations: Citation[];
  metadata: { version: number; created: string; updated: string; status: string };
}

interface Section {
  id: string;
  title: string;
  content: string;
  media: MediaItem[];
}

interface MediaItem {
  type: string;
  id: string;
  caption: string;
  src?: string;
  code?: string;
  prompt?: string;
}

interface TimelineEvent {
  year: number;
  event: string;
  description: string;
}

interface CrossRef {
  id: string;
  title: string;
  relationship: string;
}

interface Citation {
  url: string;
  title: string;
  accessed?: string;
  relevance?: string;
}

function mdToHTML(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^### (.+)$/gm, '<h3 style="font-weight:700;font-size:1.1rem;margin-top:1.25rem;margin-bottom:0.5rem;">$1</h3>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, "<p>$1</p>");
}

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    fetchArticle(slug).then((data) => {
      if (data) {
        setArticle(data);
        setLoading(false);
      } else {
        // Article not found — check if it's already being generated
        fetchArticleStatus(slug).then((status) => {
          if (status && "status" in status && status.status !== "not_found") {
            // Already generating — connect to SSE
            setGenerating(true);
            const phase = "phase" in status ? status.phase : status.status;
            setProgress(phase);
          }
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    });
  }, [slug]);

  useEffect(() => {
    if (!generating || article) return;
    const es = new EventSource(progressUrl(slug));
    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      if (data.status === "done") {
        fetchArticle(slug).then((a) => {
          if (a) setArticle(a);
          setGenerating(false);
          es.close();
        });
      } else if (data.status === "error") {
        setProgress(`Error: ${data.error}`);
        setGenerating(false);
        es.close();
      } else if (data.status === "not_queued") {
        // Not generating — stop and show the generate button
        setGenerating(false);
        es.close();
      } else {
        setProgress(data.phase || data.status);
      }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [slug, generating, article]);

  async function handleGenerate() {
    setGenerating(true);
    setProgress("queued");
    const result = await generateArticle(slug);
    if (result.status === "already_exists") {
      const a = await fetchArticle(slug);
      if (a) setArticle(a);
      setGenerating(false);
    }
  }

  async function handleRefresh() {
    setGenerating(true);
    setProgress("queued");
    await refreshArticle(slug);
  }

  // Loading
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-block w-12 h-12 border-4 border-[#e0e0e0] border-t-[#1c1917] rounded-full"
          style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // Not generated yet
  if (!article && !generating) {
    return (
      <div>
        {/* NAV */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b-3 border-black"
          style={{ background: "rgba(255,250,240,0.85)", backdropFilter: "blur(12px)", borderBottom: "3px solid var(--ink)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center text-[10px] text-white border-2 border-black shadow-[3px_3px_0_#1c1917]"
              style={{ background: "var(--orange)", fontFamily: "'Press Start 2P', monospace" }}>
              E-N
            </div>
            <a href="/" className="font-bold hidden sm:block hover:text-[#ea580c]" style={{ textDecoration: "none", color: "inherit" }}>
              Encarta-NG
            </a>
          </div>
          <a href="/" className="pixel-btn bg-[var(--ink)] text-white text-[9px] py-2">
            ← HOME
          </a>
        </nav>

        <main className="max-w-xl mx-auto px-6 py-16 text-center">
          <div className="pixel-card p-10 md:p-14" style={{ background: "var(--cream)" }}>
            <div className="text-6xl mb-8 float-anim">📖</div>

            <h1 className="pixel text-sm mb-2" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ").toUpperCase()}
            </h1>
            <p className="text-xs text-[#aaa] mb-6">TOPIC NOT YET GENERATED</p>

            <div className="w-16 h-1 mx-auto mb-6" style={{ background: "var(--orange)" }} />

            <p className="text-sm text-[#555] leading-relaxed mb-8">
              The AI agent will research the web, outline the content,
              <br />write a full article, and verify all citations.
              <br />Takes about 60 seconds.
            </p>

            <button
              onClick={handleGenerate}
              className="pixel-btn bg-[#ea580c] text-white w-full text-sm py-4"
              style={{ fontSize: "0.85rem" }}
            >
              ⚡ GENERATE ENCYCLOPEDIA ARTICLE
            </button>
          </div>

          <div className="mt-8">
            <a href="/" className="text-sm text-[#888] hover:text-[#ea580c] underline underline-offset-4"
              style={{ textDecorationColor: "var(--orange)" }}>
              ← BACK TO HOME
            </a>
          </div>
        </main>
      </div>
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
    };

    return (
      <div>
        {/* NAV */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b-3 border-black"
          style={{ background: "rgba(255,250,240,0.85)", backdropFilter: "blur(12px)", borderBottom: "3px solid var(--ink)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center text-[10px] text-white border-2 border-black shadow-[3px_3px_0_#1c1917]"
              style={{ background: "var(--orange)", fontFamily: "'Press Start 2P', monospace" }}>
              E-N
            </div>
            <a href="/" className="font-bold hidden sm:block hover:text-[#ea580c]" style={{ textDecoration: "none", color: "inherit" }}>
              Encarta-NG
            </a>
          </div>
          <a href="/" className="pixel-btn bg-[var(--ink)] text-white text-[9px] py-2">
            ← HOME
          </a>
        </nav>

        <main className="max-w-2xl mx-auto px-6 pt-12 pb-20">
          <h1 className="pixel text-lg mb-8 text-center" style={{ textTransform: "capitalize" }}>
            {slug.replace(/-/g, " ")}
          </h1>
          <GenerationBar
            entry={progressEntry}
            onRetry={() => handleGenerate()}
            onDismiss={() => { /* noop */ }}
            showWatchLive={false}
          />
        </main>
      </div>
    );
  }

  if (!article) return null;

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

  return (
    <div>
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b-3 border-black"
        style={{ background: "rgba(255,250,240,0.85)", backdropFilter: "blur(12px)", borderBottom: "3px solid var(--ink)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center text-[10px] text-white border-2 border-black shadow-[3px_3px_0_#1c1917]"
            style={{ background: "var(--orange)", fontFamily: "'Press Start 2P', monospace" }}>
            E-N
          </div>
          <a href="/" className="font-bold hidden sm:block hover:text-[#ea580c]" style={{ textDecoration: "none", color: "inherit" }}>
            Encarta-NG
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/queue" className="text-sm font-semibold hover:text-[#ea580c]">Queue</a>
          <QueueIndicator />
          <span className="text-xs text-[#888]">v{article.metadata.version}</span>
          <button onClick={handleRefresh} disabled={generating} className="pixel-btn bg-[#f59e0b] text-black"
            style={generating ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            {generating ? "REFRESHING..." : "REFRESH"}
          </button>
        </div>
      </nav>

      <article className="max-w-4xl mx-auto px-6 py-10 prose">
        {/* Title Card */}
        <div className="pixel-card p-8 md:p-10 mb-10 bg-white">
          <h1 className="pixel text-xl md:text-2xl mb-4 leading-snug" style={{ color: "var(--ink)" }}>
            {article.title}
          </h1>
          <p className="text-sm text-[#888] mb-6">
            Generated {new Date(article.metadata.updated).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric"
            })}
          </p>
          <div className="p-5 border-3 border-black mb-0" style={{ background: "var(--cream)" }}>
            <p className="text-lg font-medium leading-relaxed m-0" style={{ color: "var(--ink)" }}>
              {article.abstract}
            </p>
          </div>
        </div>

        {/* Sections */}
        {article.sections.map((section, i) => {
          const palette = sectionColors[i % sectionColors.length];
          return (
            <div key={section.id || i} className="pixel-card p-6 md:p-8 mb-6 bg-white">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 flex items-center justify-center text-xl border-3 border-black shrink-0"
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
                className="leading-relaxed text-[1.05rem]"
                style={{ color: "#222" }}
                dangerouslySetInnerHTML={{ __html: mdToHTML(section.content) }}
              />
              {section.media?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {section.media.map((m, mi) => {
                    if (m.type === "diagram" && m.code) {
                      return <MermaidDiagram key={m.id || `media-${mi}`} code={m.code} caption={m.caption} />;
                    }
                    if (m.type === "image") {
                      return (
                        <div key={m.id || `media-${mi}`} className="pixel-card-sm p-3" style={{ background: palette.bg }}>
                          <span className="pixel text-[9px] text-[#888]">IMAGE</span>
                          <div className="h-32 flex items-center justify-center text-4xl bg-white/50 my-2 border border-dashed border-black/20">
                            {m.src ? (
                              <img src={m.src} alt={m.caption} className="max-h-full object-contain" />
                            ) : (
                              <span className="text-2xl opacity-50">🖼️</span>
                            )}
                          </div>
                          <p className="text-sm">{m.caption}</p>
                          {m.prompt && (
                            <details className="mt-1">
                              <summary className="text-xs cursor-pointer text-[#888]">image prompt</summary>
                              <p className="text-xs mt-1 p-2 bg-white border">{m.prompt}</p>
                            </details>
                          )}
                        </div>
                      );
                    }
                    if (m.type === "threed") {
                      return (
                        <div key={m.id || `media-${mi}`} className="pixel-card-sm p-3" style={{ background: "#f0f0ff" }}>
                          <span className="pixel text-[9px] text-[#888]">3D SCENE</span>
                          <div className="h-32 flex items-center justify-center text-4xl bg-white/50 my-2 border border-dashed border-black/20">
                            <span className="text-2xl opacity-50">🧊</span>
                          </div>
                          <p className="text-sm">{m.caption}</p>
                          {m.code && (
                            <details className="mt-1">
                              <summary className="text-xs cursor-pointer text-[#888]">scene code</summary>
                              <pre className="text-xs mt-1 p-2 bg-white border overflow-auto max-h-32">{m.code}</pre>
                            </details>
                          )}
                        </div>
                      );
                    }
                    // Default fallback for unknown media types
                    return (
                      <div key={m.id || `media-${mi}`} className="pixel-card-sm px-4 py-3 flex items-center gap-3"
                        style={{ background: palette.bg }}>
                        <span className="pixel text-[9px] text-[#888]">[{m.type.toUpperCase()}]</span>
                        <span className="text-sm">{m.caption}</span>
                      </div>
                    );
                  })}
                </div>
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
          <div className="pixel-card p-6 md:p-8 mb-6 bg-white">
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
                  <span className="pixel text-xs text-[#888] shrink-0 mt-0.5">[{i + 1}]</span>
                  <div>
                    <a href={cite.url} target="_blank" rel="noopener" className="font-semibold hover:text-[#ea580c]"
                      style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                      {cite.title}
                    </a>
                    {cite.relevance && (
                      <span className="text-xs text-[#888] ml-2">— {cite.relevance}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* See Also */}
        {article.crossrefs.length > 0 && (
          <div className="pixel-card p-6 md:p-8 mb-6" style={{ background: "#fae8ff" }}>
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
                  className="pixel-card-sm px-4 py-2"
                  style={{ background: "white", textDecoration: "none", color: "var(--ink)", fontSize: "0.9rem" }}>
                  <span className="text-xs text-[#888] mr-2">[{ref.relationship}]</span>
                  {ref.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* FOOTER */}
      <footer className="border-t-4 border-black py-8" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="pixel text-[10px] opacity-60">ENCARTA-NG</p>
          <p className="mt-2 text-sm opacity-70">AI-powered encyclopedia · Built with OpenCode SDK</p>
        </div>
      </footer>
    </div>
  );
}
