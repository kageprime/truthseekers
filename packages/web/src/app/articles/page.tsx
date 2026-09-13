"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useGenerateArticle, useArticles, useArticleSearch,
  useArticleProgress, useCheckArticleStatus,
} from "../hooks";
import type { ArticleSummary } from "@encarta/core";
import { usePageSearch } from "../HeaderSearchContext";
import GenerationBar from "../components/GenerationBar";
import type { AgentEvent } from "../components/ProcessViewer";
import { IconLightning, IconSearch, IconGrid, IconList } from "../components/Icons";

interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Wraps a single in-flight article generation with its own SSE connection
 * via `useArticleProgress`. Phase, error, and agent events are tracked
 * locally; the parent is notified on completion / error / dismiss.
 */
function GeneratingCard({
  slug,
  title,
  onDone,
  onError,
  onDismiss,
  onRetry,
}: {
  slug: string;
  title: string;
  onDone: (slug: string) => void;
  onError: (slug: string, error: string) => void;
  onDismiss: (slug: string) => void;
  onRetry: (slug: string) => void;
}) {
  const [phase, setPhase] = useState("queued");
  const [error, setError] = useState<string | undefined>();
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);

  useArticleProgress(slug, true, {
    onAgentEvent: useCallback((event: AgentEvent) => {
      setAgentEvents((prev) => [...prev, event]);
    }, []),
    onPhase: useCallback((p: string, err?: string) => {
      setPhase(p);
      if (err) setError(err);
    }, []),
    onDone: useCallback(() => onDone(slug), [slug, onDone]),
    onError: useCallback((err: string) => {
      setError(err);
      onError(slug, err);
    }, [slug, onError]),
  });

  const entry: GeneratingEntry = { slug, title, phase, error, agentEvents };

  return (
    <GenerationBar
      entry={entry}
      onRetry={() => onRetry(slug)}
      onDismiss={() => onDismiss(slug)}
    />
  );
}

// ponytail: retro file rows — bevel hover, status chips, no glass.
function ArticleRow({ article, index }: { article: ArticleSummary; index: number }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="block bg-white border-[2px] p-2.5 no-underline text-black hover:bg-[#fff8dc]"
      style={{ borderStyle: "outset", borderWidth: 2 }}
    >
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-bold text-[#8a7f68] tabular-nums pt-0.5 w-6 shrink-0">{String(index + 1).padStart(2, "0")}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold text-[#0a2a5e] leading-snug" style={{ fontFamily: "Georgia,serif" }}>
            {article.title}
            {article.metadata?.status === "draft" && (
              <span className="ml-2 text-[9px] px-1 bg-[#c9a227] text-black border border-black font-bold" style={{ fontFamily: "Verdana,sans-serif" }}>DRAFT</span>
            )}
          </span>
          <span className="block text-[11px] leading-[1.4] mt-0.5 line-clamp-2" style={{ color: "#444" }}>
            {article.abstract || "No description"}
          </span>
          <span className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: "#8a7f68" }}>
            {(article.categories ?? []).slice(0, 3).map((cat) => (
              <span key={cat}>{cat.replace(/-/g, " ")}</span>
            ))}
            {article.metadata?.updated && (
              <span className="ml-auto tabular-nums">
                {new Date(article.metadata.updated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ArticlesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [generating, setGenerating] = useState<Map<string, GeneratingEntry>>(new Map());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { mutate: generateArticle } = useGenerateArticle();
  const { mutate: checkStatus } = useCheckArticleStatus();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSearch = debouncedQuery.trim().length > 0;
  const articlesQuery = useArticles(showSearch ? 0 : page * PAGE_SIZE, PAGE_SIZE);
  const searchQuery = useArticleSearch(showSearch ? debouncedQuery.trim() : "");

  const articles: ArticleSummary[] = showSearch
    ? (searchQuery.data ?? [])
    : (articlesQuery.data?.data ?? []);
  const loading = showSearch ? searchQuery.loading : articlesQuery.loading;
  const searching = showSearch && searchQuery.loading;

  const pagination = articlesQuery.data?.pagination;
  const totalPages = showSearch
    ? 1
    : (pagination?.hasMore ? page + 2 : page + 1);

  useEffect(() => { setMounted(true); }, []);

  // ponytail: deep-link search (?q= from home) — no Suspense needed, read once on mount.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) { setQuery(q); setDebouncedQuery(q); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePageSearch(useMemo(() => query || debouncedQuery ? {
    value: query, onChange: setQuery, onSubmit: (e: FormEvent) => { e.preventDefault(); setDebouncedQuery(query); },
    onClear: () => { setQuery(""); setDebouncedQuery(""); }, placeholder: "Search articles...",
  } : null, [query, debouncedQuery]));

  // Debounce search input
  useEffect(() => {
    if (!mounted) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim()) setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [mounted, query]);

  function startGenerate(slug: string) {
    const title = slug.replace(/-/g, " ");
    setGenerating((prev) => {
      const next = new Map(prev);
      next.set(slug, { slug, title, phase: "queued", agentEvents: [] });
      return next;
    });
    generateArticle({ slug });
  }

  function handleGenDone(slug: string) {
    setGenerating((prev) => { const next = new Map(prev); next.delete(slug); return next; });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  }

  function handleGenError(slug: string, error: string) {
    setGenerating((prev) => {
      const next = new Map(prev);
      const entry = next.get(slug);
      if (entry) next.set(slug, { ...entry, phase: "error", error });
      return next;
    });
  }

  function handleGenDismiss(slug: string) {
    setGenerating((prev) => { const next = new Map(prev); next.delete(slug); return next; });
  }

  const slugify = useCallback((text: string): string => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }, []);

  const allCategories = useMemo(
    () => Array.from(new Set(articles.flatMap(a => a.categories ?? []))).sort(),
    [articles]
  );
  const filteredArticles = useMemo(
    () => selectedCategory ? articles.filter(a => a.categories?.includes(selectedCategory)) : articles,
    [articles, selectedCategory]
  );
  return (
    <>
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">Encyclopedia • Browse</div>
        <h1 className="r-h1 mt-1">Articles</h1>
      </div>
      {/* Search */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <IconSearch size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "#8a7f68" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles..."
              aria-label="Search articles"
              className="w-full bg-white text-sm pl-8 pr-2 py-1.5 text-black"
              style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
            />
          </div>
          <button
            onClick={() => {
              const slug = slugify(query.trim());
              if (slug && !generating.has(slug)) {
                checkStatus(slug).then((existing) => {
                  if (existing && "status" in existing && existing.status === "published") {
                    router.push(`/article/${slug}`);
                  } else {
                    startGenerate(slug);
                  }
                });
              }
            }}
            disabled={!query.trim()}
            className="r-btn shrink-0 inline-flex items-center gap-1 disabled:opacity-40"
          >
            <IconLightning size={13} /> Generate
          </button>
        </div>
      </div>

        {/* Generating entries */}
        {generating.size > 0 && (
          <div className="mb-6 space-y-2 max-w-2xl mx-auto">
            {Array.from(generating.values()).map((gen) => (
              <GeneratingCard
                key={gen.slug}
                slug={gen.slug}
                title={gen.title}
                onDone={handleGenDone}
                onError={handleGenError}
                onDismiss={handleGenDismiss}
                onRetry={startGenerate}
              />
            ))}
          </div>
        )}

        {/* Filter bar */}
        {!loading && articles.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <label className="text-[11px] font-bold" htmlFor="cat-filter">Category:</label>
            <select
              id="cat-filter"
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="bg-white text-[11px] px-2 py-1 text-black"
              style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080", minWidth: 140 }}
            >
              <option value="">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setViewMode("grid")} className="r-btn px-2 py-1 inline-flex items-center" title="Grid view" aria-label="Grid view" aria-pressed={viewMode === "grid"} style={viewMode === "grid" ? { borderStyle: "inset" } : undefined}>
                <IconGrid size={12} />
              </button>
              <button onClick={() => setViewMode("list")} className="r-btn px-2 py-1 inline-flex items-center" title="List view" aria-label="List view" aria-pressed={viewMode === "list"} style={viewMode === "list" ? { borderStyle: "inset" } : undefined}>
                <IconList size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        {!loading && (
          <div className="text-[11px] mb-4 tabular-nums" style={{ color: "#8a7f68" }}>
            {searching ? "Searching..." : `${filteredArticles.length} article${filteredArticles.length !== 1 ? "s" : ""}`}
            {selectedCategory ? ` in ${selectedCategory}` : ""}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-2 py-8" aria-label="Loading articles">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border-[2px] p-2.5 animate-pulse" style={{ borderStyle: "outset", borderWidth: 2 }}>
                <div className="h-4 bg-[#e8e0c5] w-3/4" />
                <div className="h-3 bg-[#efe9d5] w-1/2 mt-2" />
              </div>
            ))}
          </div>
        ) : filteredArticles.length > 0 ? (
          <>
            {viewMode === "list" ? (
              <div className="space-y-1.5">
                {filteredArticles.map((article, i) => (
                  <ArticleRow key={`${article.slug}-${i}`} article={article} index={page * PAGE_SIZE + i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredArticles.map((article, i) => (
                  <ArticleRow key={`${article.slug}-${i}`} article={article} index={page * PAGE_SIZE + i} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!debouncedQuery.trim() && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="r-btn px-3 py-1 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  ◀ Prev
                </button>
                <span className="text-[11px] tabular-nums px-2" style={{ color: "#8a7f68" }} aria-live="polite">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="r-btn px-3 py-1 disabled:opacity-40"
                  aria-label="Next page"
                >
                  Next ▶
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 border-[2px] bg-[#ffffe1] mt-2" style={{ borderStyle: "outset", borderWidth: 2 }}>
            <div className="mx-auto mb-3 text-[#0a2a5e] flex justify-center">
              <IconSearch size={28} />
            </div>
            <h2 className="text-[15px] font-bold text-[#0a2a5e] mb-2">No articles found</h2>
            <p className="text-[12px] mb-4" style={{ color: "#555" }}>
              {query ? `No results for "${query}". Generate one.` : "Your encyclopedia is empty."}
            </p>
            {query && (
              <button
                onClick={() => {
                  const slug = slugify(query.trim());
                  if (slug) startGenerate(slug);
                }}
                className="r-btn inline-flex items-center gap-1 px-4 py-1.5"
              >
                <IconLightning size={14} /> Generate &ldquo;{query}&rdquo;
              </button>
            )}
          </div>
        )}
    </>
    );
  }
