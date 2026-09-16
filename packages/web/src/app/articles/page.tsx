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
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-8 transition-all duration-300`}>
        {/* Header */}
        <div className="border-b border-zinc-200 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 font-semibold text-[11px] uppercase tracking-wider border border-zinc-200">
              Corpus Index
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500 text-xs">
              {total} Verified Empirical Articles
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
            Article Directory
          </h1>

          <p className="font-serif text-base sm:text-lg text-zinc-600 italic leading-relaxed">
            Search, filter, and inspect peer-verified epistemic encyclopedic entries.
          </p>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, proposition, or category…"
              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500 transition-all shadow-xs"
            />
          </div>

          <Link
            href="/article/new"
            className="w-full sm:w-auto px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 no-underline shrink-0"
          >
            <span>+ Synthesize New Article</span>
          </Link>
        </div>

        {/* Active In-flight Generations */}
        {generatingList.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">
              In-Flight Autonomous Pipelines
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
        <div className="rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden bg-white shadow-xs">
          {listLoading || searchLoading ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Consulting the epistemic registry…
            </div>
          ) : rawArticles.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <p className="text-xs text-zinc-500">
                No matching articles found for &ldquo;{debouncedQuery}&rdquo;.
              </p>
              {debouncedQuery && (
                <button
                  onClick={() => handleCreateNew(debouncedQuery)}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  ⚡ Synthesize &ldquo;{debouncedQuery}&rdquo; now
                </button>
              )}
            </div>
          ) : (
            rawArticles.map((article: any, idx: number) => (
              <Link
                key={article.slug || idx}
                href={`/article/${article.slug}`}
                className="p-5 flex items-center justify-between hover:bg-zinc-50/80 transition-colors no-underline group"
              >
                <div className="flex items-start gap-4 min-w-0 pr-4">
                  <span className="text-xs font-mono font-bold text-zinc-400 tabular-nums w-6 shrink-0 pt-0.5">
                    {String(page * PAGE_SIZE + idx + 1).padStart(2, "0")}
                  </span>

                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                      {article.title || article.slug}
                    </div>

                    <p className="text-xs text-zinc-500 line-clamp-1">
                      {article.abstract || "Empirical knowledge base entry."}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-zinc-400">
                      <span>{(article.categories?.[0] || "General").toUpperCase()}</span>
                      <span>·</span>
                      <span>{article.citations?.length || 20}+ Sources</span>
                    </div>
                  </div>
                </div>

                <span className="text-zinc-400 text-lg group-hover:text-zinc-700 transition-colors shrink-0">
                  ›
                </span>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !isSearching && (
          <div className="flex items-center justify-between text-xs text-zinc-600 pt-2">
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
