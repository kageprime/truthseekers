"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useGenerateArticle,
  useArticles,
  useArticleSearch,
  useArticleProgress,
} from "../hooks";
import type { ArticleSummary } from "@encarta/core";
import GenerationBar from "../components/GenerationBar";
import type { AgentEvent } from "../components/ProcessViewer";
import { useUiMode } from "../context/UiModeContext";

interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

const PAGE_SIZE = 20;

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

export default function ArticlesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [generatingList, setGeneratingList] = useState<GeneratingEntry[]>([]);
  const { widthMode } = useUiMode();

  const { mutate: generateArticle } = useGenerateArticle();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearching = debouncedQuery.trim().length > 0;
  const { data: searchResults, loading: searchLoading } = useArticleSearch(debouncedQuery);
  const { data: listData, loading: listLoading } = useArticles(page * PAGE_SIZE, PAGE_SIZE);

  const rawArticles = isSearching
    ? ((searchResults as any)?.articles ?? [])
    : ((listData as any)?.data ?? []);

  const total = isSearching
    ? rawArticles.length
    : ((listData as any)?.total ?? rawArticles.length);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleCreateNew = async (topic: string) => {
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return;

    setGeneratingList((prev) => [
      ...prev,
      { slug, title: topic, phase: "queued" },
    ]);

    try {
      await generateArticle({ slug });
    } catch {}
  };

  const containerClass = widthMode === "expanded" ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} mx-auto transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Corpus index</span>
            <span>{total} entries</span>
          </div>
          <h1 className="plate-title">Articles</h1>
          <p className="plate-deck">
            Peer-verified epistemic entries. Search, inspect, synthesize.
          </p>
          <div className="plate-rule" />
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
          <div className="flex items-center gap-3 flex-1 border-b-2 border-ink pb-2 focus-within:border-gold transition-colors">
            <span className="text-subtle text-lg leading-none" aria-hidden>⌕</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, proposition, or category…"
              aria-label="Filter articles"
              className="flex-1 bg-transparent border-none outline-none font-serif text-lg text-ink placeholder:text-subtle min-w-0"
            />
          </div>

          <Link
            href="/article/new"
            className="category-link no-underline text-sm font-semibold shrink-0"
          >
            + Synthesize new article
          </Link>
          {rawArticles.length > 1 && (
            <button
              onClick={() => {
                const pick = rawArticles[Math.floor(Math.random() * rawArticles.length)];
                if (pick?.slug) router.push(`/article/${pick.slug}`);
              }}
              className="category-link no-underline text-sm font-medium shrink-0 cursor-pointer"
            >
              Surprise me →
            </button>
          )}
        </div>

        {/* Active In-flight Generations */}
        {generatingList.length > 0 && (
          <div className="space-y-3 py-4">
            <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold">
              In-flight pipelines
            </h2>
            {generatingList.map((entry) => (
              <GeneratingCard
                key={entry.slug}
                slug={entry.slug}
                title={entry.title}
                onDone={(slug) => {
                  queryClient.invalidateQueries({ queryKey: ["articles"] });
                  router.push(`/article/${slug}`);
                }}
                onError={() => {}}
                onDismiss={(slug) =>
                  setGeneratingList((prev) => prev.filter((e) => e.slug !== slug))
                }
                onRetry={(slug) => handleCreateNew(slug)}
              />
            ))}
          </div>
        )}

        {/* Articles List */}
        <div className="ledger">
          {listLoading || searchLoading ? (
            <p className="font-serif italic text-muted py-12 text-center">
              Consulting the epistemic registry…
            </p>
          ) : rawArticles.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <p className="font-serif italic text-muted">
                No matching articles found for &ldquo;{debouncedQuery}&rdquo;.
              </p>
              {debouncedQuery && (
                <button
                  onClick={() => handleCreateNew(debouncedQuery)}
                  className="px-4 py-2 bg-ink text-surface rounded-sharp text-xs font-semibold hover:bg-gold hover:text-ink transition-colors cursor-pointer"
                >
                  Synthesize &ldquo;{debouncedQuery}&rdquo; now
                </button>
              )}
            </div>
          ) : (
            rawArticles.map((article: any, idx: number) => (
              <Link
                key={article.slug || idx}
                href={`/article/${article.slug}`}
                className="ledger-row group"
              >
                <span className="index-numeral">
                  {String(page * PAGE_SIZE + idx + 1).padStart(2, "0")}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block font-display text-lg font-semibold text-ink group-hover:text-gold transition-colors truncate">
                    {article.title || article.slug}
                  </span>

                  <span className="block text-[13px] text-muted truncate mt-0.5">
                    {article.abstract || "Empirical knowledge base entry."}
                  </span>

                  <span className="block pt-0.5 text-[11px] font-mono uppercase tracking-[0.14em] text-subtle">
                    {(article.categories?.[0] || "General")}
                    {article.citations?.length ? `  ·  ${article.citations.length} sources` : ""}
                  </span>
                </span>

                <span className="text-subtle group-hover:text-gold transition-colors shrink-0" aria-hidden>
                  ›
                </span>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !isSearching && (
          <div className="flex items-center justify-between text-xs text-muted pt-6">
            <span className="font-mono tabular-nums">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="category-link no-underline cursor-pointer disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="category-link no-underline cursor-pointer disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
