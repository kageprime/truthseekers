"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useGenerateArticle, useArticles, useArticleSearch,
  useArticleProgress,
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

function ArticleRow({ article, index }: { article: ArticleSummary; index: number }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="block bg-[var(--r-surface-elevated)] border border-[var(--r-border)] p-3 rounded-[var(--r-radius)] no-underline text-[var(--r-ink)] hover:border-[var(--r-accent)] transition-all shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="text-[11px] font-bold text-[var(--r-muted)] tabular-nums pt-0.5 w-6 shrink-0">{String(index + 1).padStart(2, "0")}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-[var(--r-accent)] leading-snug" style={{ fontFamily: "Georgia, serif" }}>
              {article.title}
            </span>
            {article.metadata?.status === "draft" && (
              <span className="text-[9px] px-1.5 py-0.5 bg-[var(--r-header-accent)] text-black font-bold rounded-sm border border-black/30">
                DRAFT
              </span>
            )}
          </div>
          <span className="block text-[12px] leading-relaxed mt-1 line-clamp-2 text-[var(--r-ink-secondary)]">
            {article.abstract || "No description provided."}
          </span>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--r-muted)] flex-wrap">
            {(article.categories ?? []).slice(0, 3).map((cat) => (
              <span key={cat} className="bg-[var(--r-nav-bg)] px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                {cat.replace(/-/g, " ")}
              </span>
            ))}
            {article.metadata?.updated && (
              <span className="ml-auto tabular-nums">
                Updated {new Date(article.metadata.updated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>
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

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) { setQuery(q); setDebouncedQuery(q); }
    } catch {}
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(val);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
  };

  usePageSearch(query ? { value: query, onChange: handleQueryChange, onSubmit: (e) => e.preventDefault(), placeholder: "Search articles..." } : null);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => (a.categories ?? []).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return articles;
    return articles.filter((a) => (a.categories ?? []).includes(selectedCategory));
  }, [articles, selectedCategory]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const startGenerate = useCallback((slug: string) => {
    const rawTitle = query.trim() || slug.replace(/-/g, " ");
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    setGenerating((prev) => {
      const next = new Map(prev);
      next.set(slug, { slug, title, phase: "queued" });
      return next;
    });

    generateArticle({ slug })
      .then(() => {
        // Queued successfully
      })
      .catch((err) => {
        setGenerating((prev) => {
          const next = new Map(prev);
          const current = next.get(slug);
          if (current) {
            next.set(slug, { ...current, phase: "error", error: err.message || "Failed to start generation" });
          }
          return next;
        });
      });
  }, [generateArticle, query]);

  const handleGenDone = useCallback((slug: string) => {
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    setGenerating((prev) => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
    router.push(`/article/${slug}`);
  }, [queryClient, router]);

  const handleGenError = useCallback((slug: string, err: string) => {
    setGenerating((prev) => {
      const next = new Map(prev);
      const entry = next.get(slug);
      if (entry) {
        next.set(slug, { ...entry, phase: "error", error: err });
      }
      return next;
    });
  }, []);

  const handleGenDismiss = useCallback((slug: string) => {
    setGenerating((prev) => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
  }, []);

  const handleGenRetry = useCallback((slug: string) => {
    const entry = generating.get(slug);
    if (!entry) return;
    setGenerating((prev) => {
      const next = new Map(prev);
      next.set(slug, { ...entry, phase: "queued", error: undefined, agentEvents: [] });
      return next;
    });
    generateArticle({ slug });
  }, [generating, generateArticle]);

  if (!mounted) return null;

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="border-b border-[var(--r-border)] pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="r-h1 text-[26px] sm:text-[32px]">Encyclopedia Index</h1>
          <p className="text-[12px] text-[var(--r-muted)] mt-1">Browse, search, and generate evidence-grounded articles.</p>
        </div>

        {/* Generate CTA */}
        {query.trim().length > 0 && (
          <button
            onClick={() => {
              const slug = slugify(query.trim());
              if (slug) startGenerate(slug);
            }}
            className="bg-[var(--r-accent)] text-white text-[12px] font-bold px-3 py-1.5 rounded-[var(--r-radius)] hover:brightness-110 flex items-center gap-1.5 shadow-sm"
          >
            <IconLightning size={14} />
            <span>Generate &ldquo;{query.trim()}&rdquo;</span>
          </button>
        )}
      </div>

      {/* In-flight generations */}
      {generating.size > 0 && (
        <div className="space-y-3">
          {Array.from(generating.values()).map((entry) => (
            <GeneratingCard
              key={entry.slug}
              slug={entry.slug}
              title={entry.title}
              onDone={handleGenDone}
              onError={handleGenError}
              onDismiss={handleGenDismiss}
              onRetry={handleGenRetry}
            />
          ))}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] border border-[var(--r-border)]">
        <div className="relative flex-1 min-w-[200px]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search articles by title or keyword..."
            className="w-full bg-[var(--r-surface)] border border-[var(--r-border)] px-3 py-1.5 text-[13px] text-[var(--r-ink)] rounded-[var(--r-radius)] outline-none focus:ring-1 focus:ring-[var(--r-accent)]"
          />
        </div>

        {allCategories.length > 0 && (
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="bg-[var(--r-surface)] text-[12px] px-2.5 py-1.5 text-[var(--r-ink)] border border-[var(--r-border)] rounded-[var(--r-radius)] outline-none"
          >
            <option value="">All Categories ({allCategories.length})</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`r-btn px-2.5 py-1.5 ${viewMode === "grid" ? "bg-[var(--r-accent)] text-white" : ""}`}
            title="Grid view"
          >
            <IconGrid size={13} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`r-btn px-2.5 py-1.5 ${viewMode === "list" ? "bg-[var(--r-accent)] text-white" : ""}`}
            title="List view"
          >
            <IconList size={13} />
          </button>
        </div>
      </div>

      {/* Count readout */}
      {!loading && (
        <div className="text-[11px] font-bold text-[var(--r-muted)] uppercase tracking-wider">
          {searching ? "Searching..." : `${filteredArticles.length} article${filteredArticles.length !== 1 ? "s" : ""}`}
          {selectedCategory ? ` in ${selectedCategory}` : ""}
        </div>
      )}

      {/* Article Results */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] p-4 rounded-[var(--r-radius)] animate-pulse">
              <div className="h-4 bg-[var(--r-nav-bg)] w-1/2 rounded" />
              <div className="h-3 bg-[var(--r-nav-bg)] w-3/4 mt-2 rounded" />
            </div>
          ))}
        </div>
      ) : filteredArticles.length > 0 ? (
        <>
          {viewMode === "list" ? (
            <div className="space-y-2">
              {filteredArticles.map((article, i) => (
                <ArticleRow key={`${article.slug}-${i}`} article={article} index={page * PAGE_SIZE + i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredArticles.map((article, i) => (
                <ArticleRow key={`${article.slug}-${i}`} article={article} index={page * PAGE_SIZE + i} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!debouncedQuery.trim() && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="r-btn px-3 py-1.5 disabled:opacity-40"
              >
                ◀ Prev
              </button>
              <span className="text-[12px] font-bold text-[var(--r-muted)] px-3">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="r-btn px-3 py-1.5 disabled:opacity-40"
              >
                Next ▶
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 border border-[var(--r-border)] bg-[var(--r-surface-elevated)] rounded-[var(--r-radius)] p-6">
          <div className="mx-auto mb-3 text-[var(--r-accent)] flex justify-center">
            <IconSearch size={32} />
          </div>
          <h2 className="text-[16px] font-bold text-[var(--r-accent)] mb-1">No articles found</h2>
          <p className="text-[12px] text-[var(--r-muted)] mb-4">
            {query ? `No matching entries for "${query}". You can generate it on-demand.` : "Your encyclopedia index is currently empty."}
          </p>
          {query && (
            <button
              onClick={() => {
                const slug = slugify(query.trim());
                if (slug) startGenerate(slug);
              }}
              className="r-btn inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--r-accent)] text-white font-bold"
            >
              <IconLightning size={14} /> Generate &ldquo;{query}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
