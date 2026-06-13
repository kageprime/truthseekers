"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchArticles, searchArticles, fetchArticleStatus, generateArticle, fetchArticle, progressUrl } from "@/lib/api";
import PageLayout from "./components/PageLayout";
import PageHero from "./components/PageHero";
import SectionHeader from "./components/SectionHeader";
import GenerationBar from "./components/GenerationBar";
import { CardSkeleton, CardGridSkeleton } from "./components/CardSkeleton";
import type { AgentEvent } from "./components/ProcessViewer";

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
  agentEvents?: AgentEvent[];
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

export default function HomePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [generating, setGenerating] = useState<Map<string, GeneratingEntry>>(new Map());
  const [showResults, setShowResults] = useState(false);
  const [featuredCollapsed, setFeaturedCollapsed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const sseRef = useRef<Map<string, EventSource>>(new Map());
  const mountedRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    loadArticles(0, true);
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    return () => {
      sseRef.current.forEach((es) => es.close());
      sseRef.current.clear();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim() && showResults) {
      performSearch(debouncedQuery.trim());
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !infiniteLoading && !loading && !showResults) {
        setInfiniteLoading(true);
        const nextPage = page + 1;
        loadArticles(nextPage, false);
        setPage(nextPage);
      }
    }, { threshold: 0.1 });

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, infiniteLoading, loading, page, showResults]);

  async function loadArticles(p: number, reset: boolean) {
    try {
      const data = await fetchArticles(p * PAGE_SIZE, PAGE_SIZE);
      if (!mountedRef.current) return;

      const items = (data as any).data ?? [];
      const pagination = (data as any).pagination;

      if (reset) {
        setArticles(items);
        setVisibleCount(6);
      } else {
        setArticles((prev) => [...prev, ...items]);
      }

      setHasMore(pagination ? pagination.hasMore : items.length >= PAGE_SIZE);
    } catch (err) {
      if (mountedRef.current) {
        setHasMore(false);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setInfiniteLoading(false);
      }
    }
  }

  async function performSearch(searchQuery: string) {
    setSearching(true);
    try {
      const results = await searchArticles(searchQuery);
      if (mountedRef.current) {
        setArticles(results);
        setHasMore(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setArticles([]);
        setHasMore(false);
      }
    } finally {
      if (mountedRef.current) {
        setSearching(false);
        setLoading(false);
      }
    }
  }

  const slugify = useCallback((text: string): string => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setShowResults(false);
      setLoading(true);
      setArticles([]);
      setPage(0);
      loadArticles(0, true);
      return;
    }
    setShowResults(true);
    setLoading(true);
    setDebouncedQuery(query.trim());
  }

  function handleClear() {
    setQuery("");
    setShowResults(false);
    setLoading(true);
    setArticles([]);
    setPage(0);
    setVisibleCount(6);
    loadArticles(0, true);
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
    mergeEntry(slug, { phase: "queued", error: undefined, agentEvents: [] });

    try {
      await generateArticle(slug);
    } catch (err) {
      mergeEntry(slug, { phase: "error", error: String(err) });
      return;
    }

    const existing = sseRef.current.get(slug);
    if (existing) {
      existing.close();
      sseRef.current.delete(slug);
    }

    const es = new EventSource(progressUrl(slug));
    sseRef.current.set(slug, es);

    es.addEventListener("agent_event", (e) => {
      const eventData: AgentEvent = JSON.parse(e.data);
      setGenerating((prev) => {
        const next = new Map(prev);
        const entry = next.get(slug);
        if (entry) {
          next.set(slug, { ...entry, agentEvents: [...(entry.agentEvents || []), eventData] });
        }
        return next;
      });
    });

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      if (data.status === "done") {
        fetchArticle(slug).then((article) => {
          if (!article || !mountedRef.current) return;
          const summary: ArticleSummary = {
            slug: article.slug,
            title: article.title,
            abstract: article.abstract,
            metadata: { status: article.metadata?.status || "published", version: article.metadata?.version || 1, updated: article.metadata?.updated || "" },
            categories: article.categories || [],
            thumbnail: (article.sections?.[0]?.media?.find((m: any) => m.type === "image" && m.src) as any)?.src,
          };
          setArticles((prev) => {
            const filtered = prev.filter((a) => a.slug !== slug);
            return [summary, ...filtered];
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
      trackArticleView(slug);
      setQuery("");
      router.push(`/article/${slug}`);
      return;
    }

    trackArticleView(slug);
    setQuery("");
    router.push(`/generate/${slug}`);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <PageLayout>
      {/* Search bar */}
      <div className="max-w-6xl mx-auto w-full px-6 py-4">
        <form onSubmit={handleSearch} className="max-w-2xl">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "#9aa0a6" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search articles..."
                className="w-full pixel-input"
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>
            <button type="submit" disabled={searching} className="btn-primary shrink-0">
              {searching ? "..." : "Search"}
            </button>
            {query && (
              <button type="button" onClick={handleGenerate} className="btn-primary shrink-0">
                ⚡ Generate
              </button>
            )}
            {query && (
              <button type="button" onClick={handleClear} className="btn-secondary shrink-0">
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Hero wave - only on empty state */}
      {!showResults && (
        <PageHero
          title="Truthseekers"
          subtitle="The Living Encyclopedia"
          gradient="blue"
        />
      )}

      {/* Main content */}
      <main className="flex-1 pb-16" style={{ marginTop: showResults ? "2rem" : "-2rem" }}>
        <div className="max-w-6xl mx-auto w-full px-4">
        {/* Generation bars */}
        {generating.size > 0 && (
          <div className="mb-6 space-y-2">
            {Array.from(generating.values()).map((gen) => (
              <GenerationBar
                key={gen.slug}
                entry={gen}
                onRetry={(slug) => router.push(`/generate/${slug}`)}
                onDismiss={(slug) => {
                  setGenerating((prev) => {
                    const next = new Map(prev);
                    next.delete(slug);
                    return next;
                  });
                  const es = sseRef.current.get(slug);
                  if (es) {
                    es.close();
                    sseRef.current.delete(slug);
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* Article count */}
        {showResults && (
          <div className="text-sm mb-4 px-1" style={{ color: "#5f6368" }}>
            {searching ? "Searching..." : loading ? "Loading..." : `${articles.length} results`}
          </div>
        )}

        {/* Article grid */}
        {loading ? (
          <CardGridSkeleton />
        ) : !showResults && articles.length === 0 && generating.size === 0 ? (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="pixel-card-sm p-8 bg-white">
              <div className="text-5xl mb-4">📚</div>
              <h2 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>No articles yet</h2>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: "#5f6368" }}>
                The encyclopedia is empty. Use the Generate button above to create your first article.
              </p>
              <p className="text-xs mb-5" style={{ color: "#9aa0a6" }}>
                Try typing a topic like &ldquo;Ancient Rome&rdquo; and press ⚡ Generate
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="pixel-tag text-[10px]" style={{ background: "var(--ice)" }}>Ancient Rome</span>
                <span className="pixel-tag text-[10px]" style={{ background: "var(--cream)" }}>Solar System</span>
                <span className="pixel-tag text-[10px]" style={{ background: "var(--ice)" }}>Jazz Music</span>
              </div>
            </div>
          </div>
        ) : showResults && articles.length === 0 && generating.size === 0 ? (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="pixel-card-sm p-8 bg-white">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>No results found</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "#5f6368" }}>
                No articles found for &ldquo;{query}&rdquo;. Would you like to generate one?
              </p>
              <button onClick={() => router.push(`/generate/${slugify(query.trim())}`)} className="btn-primary btn-lg">
                ⚡ Generate this article
              </button>
            </div>
          </div>
        ) : (
          <>
              {/* Search results grid */}
              {showResults && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {articles.map((article) => (
                    <a
                      key={article.slug}
                      href={`/article/${article.slug}`}
                      className="pixel-card-sm p-0 overflow-hidden block"
                      style={{ background: "white", textDecoration: "none", color: "inherit" }}
                      onClick={() => trackArticleView(article.slug)}
                    >
                      <div className="w-full h-32 overflow-hidden" style={{ background: "#f1f3f4" }}>
                        {article.thumbnail ? (
                          <img
                            src={article.thumbnail}
                            alt=""
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                            style={{ background: "linear-gradient(135deg, #fef3c7, #e0f2fe)", color: "#9aa0a6" }}>
                            {article.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="pixel text-[10px] mb-1" style={{ color: "#1a1a1a" }}>
                          {article.title}
                        </h3>
                        <p className="text-xs line-clamp-2 leading-relaxed mt-1" style={{ color: "#5f6368" }}>{article.abstract}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {article.categories?.slice(0, 2).map((cat) => (
                            <span key={cat} className="pixel-tag text-[10px]">{cat}</span>
                          ))}
                          <span className="text-xs ml-auto" style={{ color: "#9aa0a6" }}>v{article.metadata.version}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                  {infiniteLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 col-span-full">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <CardSkeleton key={`inf-${i}`} />
                      ))}
                    </div>
                  )}
                  <div ref={sentinelRef} className="h-1 col-span-full" />
                </div>
              )}

            {/* Featured Articles - only on home state */}
            {!showResults && articles.length > 0 && !featuredCollapsed && (
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <SectionHeader emoji="📚" title="ARTICLES" accent="var(--orange)" />
                  <button
                    onClick={() => setFeaturedCollapsed(true)}
                    className="btn-ghost ml-auto text-sm hover:underline"
                    style={{ color: "#9aa0a6" }}
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {articles.slice(0, visibleCount).map((article) => (
                    <a
                      key={article.slug}
                      href={`/article/${article.slug}`}
                      className="pixel-card-sm p-0 overflow-hidden block"
                      style={{ background: "white", textDecoration: "none", color: "inherit" }}
                      onClick={() => trackArticleView(article.slug)}
                    >
                      <div className="w-full h-32 overflow-hidden" style={{ background: "#f1f3f4" }}>
                        {article.thumbnail ? (
                          <img
                            src={article.thumbnail}
                            alt=""
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                            style={{ background: "linear-gradient(135deg, #fef3c7, #e0f2fe)", color: "#9aa0a6" }}>
                            {article.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="pixel text-[10px] mb-1" style={{ color: "#1a1a1a" }}>
                          {article.title}
                        </h3>
                        <p className="text-xs line-clamp-2 leading-relaxed mt-1" style={{ color: "#5f6368" }}>{article.abstract}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {article.categories?.slice(0, 2).map((cat) => (
                            <span key={cat} className="pixel-tag text-[10px]">{cat}</span>
                          ))}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
                {(hasMore || visibleCount < articles.length) && (
                  <div className="text-center mt-6">
                    <button
                      onClick={() => {
                        const next = visibleCount + 6;
                        setVisibleCount(next);
                        if (next >= articles.length) {
                          const nextPage = page + 1;
                          setPage(nextPage);
                          loadArticles(nextPage, false);
                        }
                      }}
                      className="btn-primary"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
        </div>
      </main>
    </PageLayout>
  );
}

async function trackArticleView(slug: string) {
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097";
    await fetch(`${BASE}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, event: "view" }),
    });
  } catch {
    // Silently fail
  }
}
