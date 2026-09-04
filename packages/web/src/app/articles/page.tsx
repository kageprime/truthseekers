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
import PageLayout from "../components/PageLayout";
import GenerationBar from "../components/GenerationBar";
import ArticleCard from "../components/ArticleCard";
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

function ArticleRow({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="block py-5 px-4 -mx-4 transition-colors article-list-row"
      style={{ textDecoration: "none", color: "inherit", borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-[0.95rem] leading-snug mb-1.5" style={{ color: "var(--ink)" }}>
            {article.title}
            {article.metadata?.status === "draft" && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 small-caps" style={{ background: "var(--gold-bg)", color: "var(--gold)" }}>Draft</span>
            )}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2 font-serif italic" style={{ color: "var(--muted)" }}>
            {article.abstract || "No description"}
          </p>
          <div className="flex items-center gap-3 mt-3">
            {article.categories?.slice(0, 3).map((cat) => (
              <span key={cat} className="small-caps text-[10px]" style={{ color: "var(--gold)", letterSpacing: "0.08em" }}>
                {cat.replace(/-/g, " ")}
              </span>
            ))}
            {article.metadata?.updated && (
              <span className="dateline text-[10px] ml-auto" style={{ letterSpacing: "0.1em" }}>
                {new Date(article.metadata.updated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
        {article.thumbnail && (
          <div
            className="w-16 h-16 shrink-0 overflow-hidden hidden sm:block"
            style={{ background: "var(--gold-bg)", border: "1px solid var(--rule)", borderRadius: "var(--radius-sharp)" }}
          >
            <img src={article.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
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
  const categoryFilterLabel = selectedCategory || "All categories";

  return (
    <PageLayout maxWidthClass="max-w-5xl">
      <div
        style={{
          borderRadius: "var(--radius-card-lg)",
          background: "color-mix(in srgb, var(--surface-elevated) 100%, transparent)",
          border: "1px solid var(--border-light)",
          boxShadow: "0 1px 3px rgba(26,22,18,0.04)",
        }}
      >
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Search — float-island style */}
        <div className="mb-8 max-w-2xl mx-auto w-full">
          <h1 className="font-display font-bold mb-1" style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)", letterSpacing: "-0.01em", color: "var(--ink)" }}>Articles</h1>
          <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>Browse the encyclopedia</p>
          <div className="p-[3px]" style={{ borderRadius: "9999px", background: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
            <div
              className="flex items-center gap-2 px-1 py-1"
              style={{
                borderRadius: "calc(9999px - 3px)",
                background: "var(--surface)",
                border: "1px solid var(--border-light)",
              }}
            >
              <div className="relative flex-1">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--subtle)" }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full bg-transparent border-none outline-none text-sm pl-9 pr-3 py-2"
                  style={{ color: "var(--ink)" }}
                  autoFocus
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
                className="btn btn-primary btn-sm rounded-full shrink-0 cursor-pointer disabled:opacity-30"
              >
                <IconLightning size={13} /> Generate
              </button>
            </div>
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
          <div className="flex items-center gap-3 mb-6 max-w-2xl mx-auto w-full">
            <div className="p-[2px]" style={{ borderRadius: "9999px", background: "color-mix(in srgb, var(--border) 12%, transparent)" }}>
              <div
                className="flex items-center gap-0.5 px-1 py-0.5"
                style={{
                  borderRadius: "calc(9999px - 2px)",
                  background: "var(--surface)",
                }}
              >
                <select
                  value={selectedCategory || ""}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="bg-transparent border-none outline-none text-[11px] font-medium px-2 py-1"
                  style={{ color: "var(--muted)", minWidth: 120 }}
                >
                  <option value="">All categories</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ml-auto flex gap-1">
              <div className="p-[2px]" style={{ borderRadius: "9999px", background: "color-mix(in srgb, var(--border) 12%, transparent)" }}>
                <div className="flex items-center gap-0.5 px-0.5 py-0.5" style={{ borderRadius: "calc(9999px - 2px)", background: "var(--surface)" }}>
                  <button onClick={() => setViewMode("grid")} className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${viewMode === "grid" ? "bg-accent text-white dark:text-surface" : "text-muted hover:text-ink"}`} title="Grid view">
                    <IconGrid size={12} />
                  </button>
                  <button onClick={() => setViewMode("list")} className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${viewMode === "list" ? "bg-accent text-white dark:text-surface" : "text-muted hover:text-ink"}`} title="List view">
                    <IconList size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        {!loading && (
          <div className="text-[11px] font-medium mb-5 max-w-2xl mx-auto w-full" style={{ color: "var(--subtle)" }}>
            {searching ? "Searching..." : `${filteredArticles.length} article${filteredArticles.length !== 1 ? "s" : ""}`}
            {selectedCategory ? ` in ${selectedCategory}` : ""}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="max-w-2xl mx-auto w-full space-y-4 animate-pulse py-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4" style={{ borderRadius: "var(--radius-card-lg)", border: "1px solid var(--border-light)" }}>
                <div className="w-10 h-10 rounded skeleton shrink-0" style={{ borderRadius: "var(--radius-sharp)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton w-3/4 rounded" />
                  <div className="h-3 skeleton w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredArticles.length > 0 ? (
          <>
            {viewMode === "list" ? (
              <div className="max-w-2xl mx-auto w-full stagger-children">
                {filteredArticles.map((article, i) => (
                  <ArticleRow key={`${article.slug}-${i}`} article={article} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto w-full stagger-children">
                {filteredArticles.map((article, i) => {
                  const span = i === 0 ? "sm:col-span-2" : (i % 4 === 3 ? "sm:col-span-2 lg:col-span-2" : "");
                  return (
                    <div key={`${article.slug}-${i}`} className={span}>
                      <ArticleCard article={article} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Side pagination */}
            {!debouncedQuery.trim() && totalPages > 1 && (
              <>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="fixed z-40 hidden md:flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
                  style={{
                    top: "50%",
                    left: "1rem",
                    transform: "translateY(-50%)",
                    background: "var(--surface-glass)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  }}
                  title="Previous page"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="fixed z-40 hidden md:flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
                  style={{
                    top: "50%",
                    right: "1rem",
                    transform: "translateY(-50%)",
                    background: "var(--surface-glass)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  }}
                  title="Next page"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <div className="fixed z-40 hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium select-none"
                  style={{
                    bottom: "1.5rem",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--surface-glass)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--border)",
                    color: "var(--subtle)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                  {page + 1} / {totalPages}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="max-w-lg mx-auto w-full text-center py-16 stagger-children">
            <div
              className="w-16 h-16 mx-auto mb-5 flex items-center justify-center"
              style={{
                borderRadius: "var(--radius-card-lg)",
                border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)",
                background: "color-mix(in srgb, var(--accent) 6%, transparent)",
              }}
            >
              <IconSearch size={24} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="font-display font-semibold mb-2" style={{ fontSize: "1.1rem", color: "var(--ink)" }}>No articles found</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              {query ? `No results for "${query}". Generate one.` : "Your encyclopedia is empty."}
            </p>
            {query && (
              <button
                onClick={() => {
                  const slug = slugify(query.trim());
                  if (slug) startGenerate(slug);
                }}
                className="btn btn-primary rounded-full cursor-pointer"
                style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
              >
                <IconLightning size={14} /> Generate &ldquo;{query}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
      </div>
    </PageLayout>
    );
  }
