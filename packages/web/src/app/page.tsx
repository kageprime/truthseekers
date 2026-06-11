"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchArticles, searchArticles, fetchArticleStatus, generateArticle, fetchArticle, progressUrl } from "@/lib/api";
import GenerationBar from "./components/GenerationBar";
import QueueIndicator from "./components/QueueIndicator";
import TruthseekersLogo from "./components/TruthseekersLogo";

interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
  thumbnail?: string;
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
  const [showResults, setShowResults] = useState(false);
  const [featuredCollapsed, setFeaturedCollapsed] = useState(false);
  const sseRef = useRef<Map<string, EventSource>>(new Map());
  const mountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setShowResults(false);
      setLoading(true);
      const data = await fetchArticles();
      setArticles(data);
      setLoading(false);
      return;
    }
    setShowResults(true);
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

    setShowResults(true);
    startGenerate(slug);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0]">
      {/* Minimal top nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <TruthseekersLogo />
        <div className="flex items-center gap-6 text-sm text-[#5f6368]">
          <a href="/article/new" className="hover:text-[#1a1a1a] hover:underline transition-colors">New Article</a>
          <a href="/queue" className="hover:text-[#1a1a1a] hover:underline transition-colors">Queue</a>
          <QueueIndicator />
        </div>
      </nav>

      {/* Blue wave hero */}
      {!showResults && (
        <header className="relative overflow-hidden bg-gradient-to-b from-[#0c4a6e] via-[#0284c7] to-[#7dd3fc]">
          <div className="relative z-10 py-16 md:py-20 text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-2 drop-shadow-lg">
              Truthseekers
            </h1>
            <p className="text-lg text-[#e0f2fe] tracking-wide font-medium">The Living Encyclopedia</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 md:h-24 overflow-hidden pointer-events-none">
            <svg className="absolute bottom-0 w-[200%] h-full" viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ animation: "wave 12s linear infinite" }}>
              <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill="#fffaf0" />
            </svg>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 pb-16" style={{ marginTop: showResults ? "2rem" : "-2rem" }}>
        {/* Search bar */}
        <div className="relative z-20 w-full max-w-2xl">
          <form onSubmit={handleSearch} className="relative">
            <div className="flex items-center w-full rounded-full border border-[#dfe1e5] hover:shadow-md hover:border-[#c6c6c6] focus-within:shadow-md focus-within:border-[#c6c6c6] transition-shadow bg-white px-5 py-3">
              <svg className="w-5 h-5 text-[#9aa0a6] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or generate an article..."
                className="flex-1 ml-3 text-base text-[#1a1a1a] placeholder-[#9aa0a6] outline-none bg-transparent"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setShowResults(false); inputRef.current?.focus(); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#f0f0f0] text-[#70757a] shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] text-sm rounded-md border border-transparent hover:border-[#dadce0] transition-all"
              >
                Search Articles
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!query.trim()}
                className="px-6 py-2.5 bg-[#ea580c] hover:bg-[#d9530b] text-white text-sm rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ⚡ Generate Article
              </button>
            </div>
          </form>

          {/* Hint text */}
          {!showResults && (
            <p className="text-center text-xs text-[#9aa0a6] mt-3">
              Press Enter to search · Shift+Enter to generate
            </p>
          )}
        </div>

        {/* Results */}
        {showResults && (
          <div className="w-full max-w-3xl mt-10">
            {/* Generation bars */}
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

            {/* Article count */}
            <div className="text-sm text-[#5f6368] mb-4 px-1">
              {loading ? "Loading..." : `${articles.length} results`}
            </div>

            {/* Article grid */}
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-8 h-8 border-4 border-[#e0e0e0] border-t-[#1a1a1a] rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : articles.length === 0 && generating.size === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#5f6368] text-lg mb-4">No articles found.</p>
                <button
                  onClick={handleGenerate}
                  className="text-[#ea580c] hover:underline text-sm"
                >
                  Generate this article →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {articles.map((article) => (
                  <a
                    key={article.slug}
                    href={`/article/${article.slug}`}
                    className="block p-4 rounded-lg hover:bg-[#f8f9fa] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#fef3c7] border-2 border-[#1a1a1a] flex items-center justify-center text-lg shrink-0">
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-[#1a0dab] group-hover:underline truncate">
                          {article.title}
                        </h3>
                        <p className="text-sm text-[#006621] mt-0.5">
                          truthseeker.fly.dev/article/{article.slug}
                        </p>
                        <p className="text-sm text-[#4d5156] mt-1 line-clamp-2 leading-relaxed">
                          {article.abstract}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {article.categories?.slice(0, 3).map((cat) => (
                            <span key={cat} className="text-xs px-2 py-0.5 bg-[#f1f3f4] rounded text-[#5f6368]">
                              {cat}
                            </span>
                          ))}
                          <span className="text-xs text-[#9aa0a6]">v{article.metadata.version}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Featured Articles - only on empty state */}
        {!showResults && !loading && articles.length > 0 && !featuredCollapsed && (
          <div className="w-full max-w-4xl mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wide">Featured Articles</h2>
              <button
                onClick={() => setFeaturedCollapsed(true)}
                className="text-[#9aa0a6] hover:text-[#1a1a1a] transition-colors p-1"
                aria-label="Collapse featured articles"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {articles.slice(0, 6).map((article) => (
                <a
                  key={article.slug}
                  href={`/article/${article.slug}`}
                  className="group p-0 rounded-xl border border-[#dfe1e5] hover:border-[#c6c6c6] hover:shadow-md transition-all bg-white overflow-hidden"
                >
                  <div className="w-full h-28 bg-[#f1f3f4] overflow-hidden">
                    {article.thumbnail ? (
                      <img src={article.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#9aa0a6]" style={{ background: "linear-gradient(135deg, #fef3c7, #e0f2fe)" }}>
                        {article.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-[#1a1a1a] text-sm truncate group-hover:text-[#ea580c] transition-colors">{article.title}</h3>
                    <p className="text-xs text-[#5f6368] line-clamp-2 leading-relaxed mt-1">{article.abstract}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {article.categories?.slice(0, 2).map((cat) => (
                        <span key={cat} className="text-[10px] px-2 py-0.5 bg-[#f1f3f4] rounded text-[#5f6368]">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#dadce0] py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-[#5f6368]">
          <div className="flex items-center gap-4">
            <span className="font-medium text-[#1a1a1a]">Truthseekers</span>
            <span className="text-xs">AI-powered encyclopedia</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/queue" className="hover:underline">Queue</a>
            <span className="text-xs">Built with OpenCode SDK</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
