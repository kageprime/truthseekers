"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchArticles, searchArticles, fetchArticle, fetchArticleStatus, progressUrl } from "@/lib/api";
import type { ArticleSummary } from "@encarta/core";
import { useGenerateArticle, useArticleStatus } from "../hooks";
import PageLayout from "../components/PageLayout";
import SectionHeader from "../components/SectionHeader";
import PageHero from "../components/PageHero";
import GenerationBar from "../components/GenerationBar";
import ArticleCard from "../components/ArticleCard";
import { CardSkeleton, CardGridSkeleton } from "../components/CardSkeleton";
import type { AgentEvent } from "../components/ProcessViewer";
import { IconLightning, IconSearch, IconBook } from "../components/Icons";

interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

export default function ArticlesPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [generating, setGenerating] = useState<Map<string, GeneratingEntry>>(new Map());
  const [showResults, setShowResults] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const { mutate: generateArticle } = useGenerateArticle();
  const sseRef = useRef<Map<string, EventSource>>(new Map());
  const mountedRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from reset — use callback with getArticles in closure
  const loadArticles = useCallback(async (p: number, reset: boolean) => {
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
    setInitialLoading(false);
    setInfiniteLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadArticles(0, true);
    return () => { mountedRef.current = false; };
  }, [loadArticles]);

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
      if (entries[0].isIntersecting && hasMore && !infiniteLoading && !initialLoading && !showResults) {
        setInfiniteLoading(true);
        const nextPage = page + 1;
        loadArticles(nextPage, false);
        setPage(nextPage);
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [hasMore, infiniteLoading, initialLoading, page, showResults, loadArticles]);

  async function performSearch(searchQuery: string) {
    setSearching(true);
    try {
      const results = await searchArticles(searchQuery);
      if (mountedRef.current) {
        setArticles(results);
        setHasMore(false);
      }
    } catch {
      if (mountedRef.current) { setArticles([]); setHasMore(false); }
    } finally {
      if (mountedRef.current) { setSearching(false); setInitialLoading(false); }
    }
  }

  const slugify = useCallback((text: string): string => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setShowResults(false);
      setInitialLoading(true);
      setArticles([]);
      setPage(0);
      loadArticles(0, true);
      return;
    }
    setShowResults(true);
    setInitialLoading(true);
    setDebouncedQuery(query.trim());
  }

  function handleClear() {
    setQuery("");
    setShowResults(false);
    setInitialLoading(true);
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

  function startGenerate(slug: string) {
    mergeEntry(slug, { phase: "queued", error: undefined, agentEvents: [] });

    generateArticle({ slug }).then(() => {
      const existing = sseRef.current.get(slug);
      if (existing) { existing.close(); sseRef.current.delete(slug); }

      const es = new EventSource(progressUrl(slug));
      sseRef.current.set(slug, es);

      es.addEventListener("agent_event", (e) => {
        const eventData: AgentEvent = JSON.parse(e.data);
        setGenerating((prev) => {
          const next = new Map(prev);
          const entry = next.get(slug);
          if (entry) next.set(slug, { ...entry, agentEvents: [...(entry.agentEvents || []), eventData] });
          return next;
        });
      });

      es.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        if (data.status === "done") {
          fetchArticle(slug).then((article) => {
            if (!article || !mountedRef.current) return;
            const summary: ArticleSummary = {
              slug: article.slug, title: article.title, abstract: article.abstract,
              metadata: { status: article.metadata?.status || "published", version: article.metadata?.version || 1, updated: article.metadata?.updated || "" },
              categories: article.categories || [],
              thumbnail: (article.sections?.[0]?.media?.find((m: any) => m.type === "image" && m.src) as any)?.src,
            };
            setArticles((prev) => [summary, ...prev.filter((a) => a.slug !== slug)]);
            setGenerating((prev) => { const next = new Map(prev); next.delete(slug); return next; });
          });
          es.close(); sseRef.current.delete(slug);
        } else if (data.status === "error") {
          mergeEntry(slug, { phase: "error", error: data.error || "Unknown error" });
          es.close(); sseRef.current.delete(slug);
        } else {
          mergeEntry(slug, { phase: data.phase || data.status });
        }
      });

      es.onerror = () => { es.close(); sseRef.current.delete(slug); };
    }).catch((err) => {
      mergeEntry(slug, { phase: "error", error: String(err) });
    });
  }

  async function handleGenerate() {
    const slug = slugify(query.trim());
    if (!slug || generating.has(slug)) return;
    const existing = await fetchArticleStatus(slug);
    if (existing && "status" in existing && existing.status === "published") {
      router.push(`/article/${slug}`);
      return;
    }
    setShowResults(true);
    startGenerate(slug);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); handleGenerate(); }
  };

  return (
    <PageLayout
      headerSearch={{
        value: query, onChange: setQuery, onSubmit: handleSearch, onClear: handleClear,
        placeholder: "Search articles...",
      }}
    >
      <PageHero title="Articles" subtitle="Browse and search the encyclopedia" gradient="blue" />

      <main className="flex-1 overflow-y-auto pb-16">
        <div className="max-w-6xl mx-auto w-full px-4">
          {query && (
            <div className="py-4 flex items-center gap-3">
              <button onClick={handleGenerate} onKeyDown={handleKeyDown} className="btn btn-primary">
                <IconLightning size={16} /> Generate &ldquo;{query}&rdquo;
              </button>
              <span className="text-xs" style={{ color: "var(--subtle)" }}>Press Shift+Enter to generate</span>
            </div>
          )}

          {generating.size > 0 && (
            <div className="mb-6 space-y-2">
              {Array.from(generating.values()).map((gen) => (
                <GenerationBar
                  key={gen.slug} entry={gen}
                  onRetry={(slug) => startGenerate(slug)}
                  onDismiss={(slug) => {
                    setGenerating((prev) => { const next = new Map(prev); next.delete(slug); return next; });
                    const es = sseRef.current.get(slug);
                    if (es) { es.close(); sseRef.current.delete(slug); }
                  }}
                />
              ))}
            </div>
          )}

          {showResults && (
            <div className="text-sm mb-4 px-1" style={{ color: "var(--muted)" }}>
              {searching ? "Searching..." : initialLoading ? "Loading..." : `${articles.length} results`}
            </div>
          )}

          {initialLoading ? (
            <CardGridSkeleton />
          ) : showResults && articles.length === 0 && generating.size === 0 ? (
            <div className="max-w-lg mx-auto text-center py-8">
              <div className="glass-card-static p-8">
                <div className="mb-4"><IconSearch size={48} /></div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>No results found</h2>
                <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--muted)" }}>
                  No articles found for &ldquo;{query}&rdquo;. Would you like to generate one?
                </p>
                <button onClick={handleGenerate} className="btn btn-primary btn-lg">
                  <IconLightning size={18} /> Generate this article
                </button>
              </div>
            </div>
          ) : (
            <>
              {showResults && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {articles.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                  {infiniteLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 col-span-full">
                      {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={`inf-${i}`} />)}
                    </div>
                  )}
                  <div ref={sentinelRef} className="h-1 col-span-full" />
                </div>
              )}

              {!showResults && articles.length === 0 && !initialLoading && (
                <div className="max-w-lg mx-auto text-center py-16">
                  <div className="glass-card-static p-10">
                    <div className="mb-4"><IconBook size={56} /></div>
                    <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>No articles yet</h2>
                    <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--muted)" }}>
                      Your encyclopedia is empty. Search a topic or generate your first article to get started.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xs font-medium" style={{ color: "var(--subtle)" }}>Try:</span>
                      <button onClick={() => { setQuery("Roman Empire"); setShowResults(true); setInitialLoading(true); setDebouncedQuery("Roman Empire"); }} className="btn btn-secondary btn-sm">Roman Empire</button>
                      <button onClick={() => { setQuery("Black Holes"); setShowResults(true); setInitialLoading(true); setDebouncedQuery("Black Holes"); }} className="btn btn-secondary btn-sm">Black Holes</button>
                      <button onClick={() => { setQuery("Silk Road"); setShowResults(true); setInitialLoading(true); setDebouncedQuery("Silk Road"); }} className="btn btn-secondary btn-sm">Silk Road</button>
                    </div>
                  </div>
                </div>
              )}

              {!showResults && articles.length > 0 && (
                <section>
                  <div className="flex items-center gap-4 mb-6">
                    <SectionHeader icon={IconBook} title="ARTICLES" accent="var(--accent)" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {articles.slice(0, visibleCount).map((article) => (
                      <ArticleCard key={article.slug} article={article} />
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
                        className="btn btn-primary"
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
