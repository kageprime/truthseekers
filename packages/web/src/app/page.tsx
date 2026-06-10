"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchArticles, searchArticles, fetchArticleStatus, generateArticle, fetchArticle, progressUrl } from "@/lib/api";
import GenerationBar from "./components/GenerationBar";
import QueueIndicator from "./components/QueueIndicator";

interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
}

interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
}

export default function HomePage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Map<string, GeneratingEntry>>(new Map());
  const sseRef = useRef<Map<string, EventSource>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchArticles().then((data) => {
      if (mountedRef.current) {
        setArticles(data);
        setLoading(false);
      }
    });
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    return () => {
      sseRef.current.forEach((es) => es.close());
    };
  }, []);

  const slugify = useCallback((text: string): string => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setLoading(true);
      const data = await fetchArticles();
      setArticles(data);
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await searchArticles(query);
    setArticles(results);
    setLoading(false);
  }

  function mergeEntry(slug: string, updates: Partial<GeneratingEntry>) {
    setGenerating((prev) => {
      const next = new Map(prev);
      const current = next.get(slug);
      next.set(slug, { slug, title: slug.replace(/-/g, " "), phase: "queued", ...current, ...updates });
      return next;
    });
  }

  async function startGenerate(slug: string) {
    mergeEntry(slug, { phase: "queued", error: undefined });

    try {
      await generateArticle(slug);
    } catch (err) {
      mergeEntry(slug, { phase: "error", error: String(err) });
      return;
    }

    const existing = sseRef.current.get(slug);
    if (existing) existing.close();

    const es = new EventSource(progressUrl(slug));
    sseRef.current.set(slug, es);

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      if (data.status === "done") {
        fetchArticle(slug).then((article) => {
          if (!article || !mountedRef.current) return;
          setArticles((prev) => {
            const filtered = prev.filter((a) => a.slug !== slug);
            return [article, ...filtered];
          });
          setGenerating((prev) => {
            const next = new Map(prev);
            next.delete(slug);
            return next;
          });
        });
        es.close();
        sseRef.current.delete(slug);
      } else if (data.status === "error") {
        mergeEntry(slug, { phase: "error", error: data.error || "Unknown error" });
        es.close();
        sseRef.current.delete(slug);
      } else {
        mergeEntry(slug, { phase: data.phase || data.status });
      }
    });

    es.onerror = () => {
      es.close();
      sseRef.current.delete(slug);
    };
  }

  async function handleGenerate() {
    const slug = slugify(query.trim());
    if (!slug) return;
    if (generating.has(slug)) return;

    const existing = await fetchArticleStatus(slug);
    if (existing && "status" in existing && existing.status === "published") {
      setQuery("");
      window.location.href = `/article/${slug}`;
      return;
    }

    if ("status" in (existing ?? {}) && (existing as { status: string }).status === "not_found") {
      // doesn't exist, generate
    }

    startGenerate(slug);
  }

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
          <span className="font-bold hidden sm:block">Encarta-NG</span>
        </div>
        <div className="flex gap-4 items-center">
          <a href="/" className="text-sm font-semibold hover:text-[#ea580c] underline underline-offset-4" style={{ textDecorationColor: "var(--orange)" }}>Home</a>
          <a href="/article/new" className="text-sm font-semibold hover:text-[#ea580c]">New Article</a>
          <a href="/queue" className="text-sm font-semibold hover:text-[#ea580c]">Queue</a>
          <QueueIndicator />
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c4a6e] via-[#0284c7] to-[#7dd3fc]" />
        <div className="absolute inset-0 opacity-15"
          style={{ backgroundImage: "url('data:image/svg+xml,<svg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"><g fill=\"none\" fill-rule=\"evenodd\"><circle fill=\"%23fff\" cx=\"30\" cy=\"30\" r=\"2\"/></g></svg>')" }} />
        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
          <svg className="absolute bottom-0 w-[200%] h-full" viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ animation: "wave 12s linear infinite" }}>
            <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill="var(--warm)" />
          </svg>
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-28 text-center">
          <div className="inline-block px-4 py-2 mb-6 text-[10px]"
            style={{ fontFamily: "'Press Start 2P', monospace", background: "var(--cream)", border: "3px solid var(--ink)", boxShadow: "4px 4px 0px var(--ink)" }}>
            ALPHA v0.1 · AI-POWERED
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl text-white leading-tight"
            style={{ fontFamily: "'Press Start 2P', monospace", textShadow: "4px 4px 0 #1c1917, 8px 8px 0 #ea580c" }}>
            ENCARTA<span className="text-[#fbbf24]">-</span>NG
          </h1>
          <div className="mt-4 inline-block px-6 py-2 text-sm md:text-lg text-[#fbbf24] border-4 border-white"
            style={{ background: "var(--ink)", fontFamily: "'Press Start 2P', monospace", boxShadow: "6px 6px 0 #ea580c" }}>
            THE LIVING ENCYCLOPEDIA
          </div>
          <p className="mt-8 text-xl md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed" style={{ color: "var(--cream)" }}>
            Knowledge that writes itself
          </p>
          <p className="mt-3 text-[#e0f2fe] max-w-2xl mx-auto text-lg">
            AI agents research, write, and verify encyclopedia articles. You explore.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <div className="pixel-card px-6 py-3 bg-white"><span className="text-2xl">🔬</span><span className="ml-2 font-bold">Research</span></div>
            <div className="pixel-card px-6 py-3 bg-white"><span className="text-2xl">✍️</span><span className="ml-2 font-bold">Write</span></div>
            <div className="pixel-card px-6 py-3 bg-white"><span className="text-2xl">✅</span><span className="ml-2 font-bold">Verify</span></div>
            <div className="pixel-card px-6 py-3 bg-white"><span className="text-2xl">🗺️</span><span className="ml-2 font-bold">Explore</span></div>
          </div>
        </div>
      </header>

      {/* SEARCH + CONTENT */}
      <main className="max-w-5xl mx-auto px-6 -mt-8 relative z-10 pb-20">
        <form onSubmit={handleSearch} className="flex gap-3 mb-10">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or generate an article..." className="pixel-input flex-1" />
          <button type="submit" className="pixel-btn bg-[#0c4a6e] text-white">SEARCH</button>
          <button type="button" onClick={handleGenerate}
            disabled={!query.trim()}
            className="pixel-btn bg-[#ea580c] text-white">
            GENERATE
          </button>
        </form>

        <div className="flex items-center justify-between mb-6">
          <div className="pixel-section-header bg-[#0c4a6e] text-white">ARTICLES</div>
          <a href="/article/new" className="pixel-btn bg-[#f59e0b] text-black">+ NEW</a>
        </div>

        {(() => {
          if (loading) {
            return (
              <div className="text-center py-16">
                <div className="inline-block w-12 h-12 border-4 border-[#e0e0e0] border-t-[#1c1917] rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
                <p className="mt-4 text-[#888]">Loading...</p>
              </div>
            );
          }

          if (articles.length === 0 && generating.size === 0 && !query.trim()) {
            return (
              <div className="pixel-card p-12 text-center">
                <div className="text-5xl mb-4 float-anim">📖</div>
                <h2 className="pixel text-lg mb-3">NO ARTICLES YET</h2>
                <p className="text-[#666] mb-6">Generate your first article to start building the encyclopedia.</p>
                <a href="/article/new" className="pixel-btn bg-[#ea580c] text-white inline-block" style={{ textDecoration: "none" }}>
                  GENERATE FIRST ARTICLE
                </a>
              </div>
            );
          }

          if (articles.length === 0 && generating.size === 0 && query.trim()) {
            return (
              <div className="max-w-2xl mx-auto">
                <div className="pixel-card p-8 text-center" style={{ background: "var(--cream)" }}>
                  <div className="text-5xl mb-4 float-anim">🔍</div>
                  <h2 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>
                    NOT FOUND: {slugify(query.trim()).replace(/-/g, " ")}
                  </h2>
                  <p className="text-[#666] mb-2">No article exists for this topic yet.</p>
                  <p className="text-[#888] text-sm mb-6">The AI will research the web and write a full encyclopedia article.</p>
                  <button onClick={handleGenerate} className="pixel-btn bg-[#ea580c] text-white">
                    ⚡ GENERATE THIS ARTICLE
                  </button>
                </div>
              </div>
            );
          }

          return (
            <>
              {generating.size > 0 && (
                <div className="mb-6 space-y-2">
                  {Array.from(generating.values()).map((gen) => (
                    <GenerationBar
                      key={gen.slug}
                      entry={gen}
                      onRetry={(slug) => startGenerate(slug)}
                      onDismiss={(slug) => {
                        setGenerating((prev) => {
                          const next = new Map(prev);
                          next.delete(slug);
                          return next;
                        });
                        sseRef.current.get(slug)?.close();
                        sseRef.current.delete(slug);
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {articles.map((article) => (
                  <a
                    key={article.slug}
                    href={`/article/${article.slug}`}
                    className="pixel-card p-6 bg-white cursor-pointer block"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <h2 className="font-black text-xl mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {article.title}
                    </h2>
                    <p className="text-[#555] text-sm leading-relaxed mb-4 line-clamp-3">
                      {article.abstract}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 flex-wrap">
                        {article.categories?.slice(0, 3).map((cat) => (
                          <span key={cat} className="pixel-tag">{cat}</span>
                        ))}
                      </div>
                      <span className="text-xs text-[#aaa]">v{article.metadata.version}</span>
                    </div>
                  </a>
                ))}
              </div>
            </>
          );
        })()}
      </main>

      {/* FOOTER */}
      <footer className="border-t-4 border-black py-8" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="pixel text-[10px] opacity-60">ENCARTA-NG</p>
          <p className="mt-2 text-sm opacity-70">AI-powered encyclopedia · Built with OpenCode SDK</p>
        </div>
      </footer>
    </div>
  );
}
