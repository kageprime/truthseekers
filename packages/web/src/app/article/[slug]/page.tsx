"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchArticle, fetchArticleStatus, generateArticle, refreshArticle, progressUrl } from "@/lib/api";
import MermaidDiagram from "../../components/MermaidDiagram";
import InteractiveTimeline from "../../components/InteractiveTimeline";
import GenerationBar from "../../components/GenerationBar";
import QueueIndicator from "../../components/QueueIndicator";
import { SkeletonImage, BlankSlateImage, BlankSlateMedia, FigureImage } from "../../components/MediaImage";
import TruthseekersLogo from "../../components/TruthseekersLogo";

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
  source?: string;
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
  let html = md;

  // Tables — match header row + separator + body rows
  html = html.replace(
    /(\|[^\n]+\|\n\|[-:| ]+\|\n)((?:\|[^\n]+\|\n?)*)/g,
    (_, headerSep, body) => {
      const headerRow = headerSep.split("\n")[0];
      const headers = headerRow.split("|").filter((c: string) => c.trim()).map((c: string) => c.trim());
      const bodyRows = body.trim().split("\n").filter(Boolean);

      const thead = `<thead><tr>${headers.map((h: string) => `<th style="padding:0.5rem 0.75rem;border:2px solid #1c1917;background:#fef3c7;text-align:left;font-family:'Press Start 2P',monospace;font-size:0.65rem;">${h}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${bodyRows.map((row: string) => {
        const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => c.trim());
        return `<tr>${cells.map((c: string) => `<td style="padding:0.4rem 0.75rem;border:1.5px solid #ddd;font-size:0.9rem;">${c}</td>`).join("")}</tr>`;
      }).join("")}</tbody>`;

      return `<table style="width:100%;border-collapse:collapse;border:3px solid #1c1917;margin:1rem 0;box-shadow:4px 4px 0 rgba(28,25,23,0.1);"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    }
  );

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid var(--orange);padding:0.75rem 1rem;margin:1rem 0;background:var(--cream);font-style:italic;">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^(\- .+(?:\n\- .+)*)/gm, (match: string) => {
    const items = match.split("\n").map((l: string) => `<li>${l.replace(/^\- /, "")}</li>`).join("");
    return `<ul style="padding-left:1.5rem;margin:0.5rem 0;">${items}</ul>`;
  });

  // Code blocks (inline)
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.9em;border:1px solid #ddd;">$1</code>');

  // Bold, italic, links
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-weight:700;font-size:1.1rem;margin-top:1.25rem;margin-bottom:0.5rem;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-weight:800;font-size:1.3rem;margin-top:1.5rem;margin-bottom:0.5rem;border-bottom:2px solid #e0e0e0;padding-bottom:0.25rem;">$1</h2>');

  // Paragraphs — avoid wrapping already-converted elements
  html = "<p>" + html.replace(/\n\n+/g, "</p><p>") + "</p>";

  return html;
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
      <div className="min-h-screen flex flex-col bg-[#fffaf0]">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5]">
          <TruthseekersLogo />
        </nav>
        <main className="flex-1 flex items-center justify-center">
          <div className="inline-block w-8 h-8 border-4 border-[#e0e0e0] border-t-[#1a1a1a] rounded-full"
            style={{ animation: "spin 0.8s linear infinite" }} />
        </main>
      </div>
    );
  }

  // Not generated yet
  if (!article && !generating) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fffaf0]">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5]">
          <TruthseekersLogo />
          <div className="flex items-center gap-6 text-sm text-[#5f6368]">
            <a href="/" className="hover:text-[#1a1a1a] hover:underline">Home</a>
            <a href="/queue" className="hover:text-[#1a1a1a] hover:underline">Queue</a>
          </div>
        </nav>

        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg text-center">
            <div className="text-6xl mb-6">📖</div>
            <h1 className="text-xl font-bold text-[#1a1a1a] mb-2">
              {slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </h1>
            <p className="text-sm text-[#9aa0a6] mb-6">Topic not yet generated</p>
            <p className="text-sm text-[#5f6368] leading-relaxed mb-8">
              The AI agent will research the web, outline the content, write a full article, and verify all citations.
            </p>
            <button
              onClick={handleGenerate}
              className="px-8 py-3 bg-[#ea580c] hover:bg-[#d9530b] text-white font-medium rounded-lg transition-all"
            >
              ⚡ Generate Encyclopedia Article
            </button>
            <div className="mt-6">
              <a href="/" className="text-sm text-[#5f6368] hover:text-[#ea580c] hover:underline">
                ← Back to home
              </a>
            </div>
          </div>
        </main>

        <footer className="border-t border-[#dadce0] py-4 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-[#5f6368]">
            <span className="font-medium text-[#1a1a1a]">Truthseekers</span>
            <span className="text-xs">AI-powered encyclopedia</span>
          </div>
        </footer>
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
      <div className="min-h-screen flex flex-col bg-[#fffaf0]">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5]">
          <TruthseekersLogo />
          <div className="flex items-center gap-6 text-sm text-[#5f6368]">
            <a href="/" className="hover:text-[#1a1a1a] hover:underline">Home</a>
            <a href="/queue" className="hover:text-[#1a1a1a] hover:underline">Queue</a>
          </div>
        </nav>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg">
            <h1 className="text-xl font-bold text-center text-[#1a1a1a] mb-8 capitalize">
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

        <footer className="border-t border-[#dadce0] py-4 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-[#5f6368]">
            <span className="font-medium text-[#1a1a1a]">Truthseekers</span>
            <span className="text-xs">AI-powered encyclopedia</span>
          </div>
        </footer>
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
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5] bg-white/90 backdrop-blur-sm">
        <TruthseekersLogo />
        <div className="flex items-center gap-3 sm:gap-6">
          <a href="/queue" className="text-sm text-[#5f6368] hover:text-[#1a1a1a] hover:underline">Queue</a>
          <QueueIndicator />
          <span className="hidden sm:inline text-xs text-[#9aa0a6]">v{article.metadata.version}</span>
          <button
            onClick={handleRefresh}
            disabled={generating}
            className="px-3 py-1.5 text-sm bg-[#f59e0b] hover:bg-[#e08e0a] text-[#1a1a1a] rounded-md transition-colors disabled:opacity-50"
          >
            {generating ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </nav>

      <article className="max-w-6xl mx-auto px-6 py-10 prose">
        {/* Title Card */}
        <div className="pixel-card p-4 sm:p-8 md:p-10 mb-10 bg-white">
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
            <div key={section.id || i} className="pixel-card p-4 sm:p-6 md:p-8 mb-6 bg-white">
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
                className="leading-relaxed text-[1.05rem] overflow-x-auto break-words"
                style={{ color: "#222" }}
                dangerouslySetInnerHTML={{ __html: mdToHTML(section.content) }}
              />
              {section.media && section.media.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {section.media.map((m, mi) => {
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
                  <span className="pixel text-xs text-[#888] shrink-0 mt-0.5">[{i + 1}]</span>
                  <div className="min-w-0">
                    <a href={cite.url} target="_blank" rel="noopener" className="font-semibold hover:text-[#ea580c] break-all"
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
                  <span className="text-xs text-[#888] mr-2">[{ref.relationship}]</span>
                  {ref.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* FOOTER */}
      <footer className="border-t border-[#dadce0] py-6 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-sm text-[#5f6368] gap-1">
          <span className="font-medium text-[#1a1a1a]">Truthseekers</span>
          <span className="text-xs">AI-powered encyclopedia · Built with OpenCode SDK</span>
        </div>
      </footer>
    </div>
  );
}
