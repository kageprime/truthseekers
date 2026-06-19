"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchArticles, searchArticles, fetchArticle, fetchArticleStatus, progressUrl } from "@/lib/api";
import type { ArticleSummary } from "@encarta/core";
import { useGenerateArticle, useArticleStatus } from "../hooks";
import { usePageSearch } from "../HeaderSearchContext";
import PageLayout from "../components/PageLayout";
import GenerationBar from "../components/GenerationBar";
import ArticleCard from "../components/ArticleCard";
import type { AgentEvent } from "../components/ProcessViewer";
import { IconLightning, IconSearch, IconBook, IconGrid, IconList } from "../components/Icons";

interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function ArticleRow({ article }: { article: ArticleSummary }) {
  return (
    <Link href={`/article/${article.slug}`} className="block py-3 px-4 -mx-4 rounded-lg transition-colors hover:bg-[var(--accent-bg)]/40" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-snug mb-0.5" style={{ color: "var(--ink)" }}>
            {article.title}
            {article.metadata?.status === "draft" && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--gold-bg)", color: "var(--gold)" }}>Draft</span>
            )}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--muted)" }}>{article.abstract || "No description"}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {article.categories?.slice(0, 3).map((cat) => (
              <span key={cat} className="tag tag-subtle text-[10px]">{cat}</span>
            ))}
            {article.metadata?.updated && (
              <span className="text-[10px]" style={{ color: "var(--subtle)" }}>{new Date(article.metadata.updated).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        {article.thumbnail && (
          <div className="w-16 h-16 rounded-lg shrink-0 overflow-hidden hidden sm:block" style={{ background: "var(--skeleton-start)" }}>
            <img src={article.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ArticlesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [generating, setGenerating] = useState<Map<string, GeneratingEntry>>(new Map());
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { mutate: generateArticle } = useGenerateArticle();
  const sseRef = useRef<Map<string, EventSource>>(new Map());
  const mountedRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  usePageSearch(useMemo(() => query || debouncedQuery ? {
    value: query, onChange: setQuery, onSubmit: (e: FormEvent) => { e.preventDefault(); setDebouncedQuery(query); },
    onClear: () => { setQuery(""); setDebouncedQuery(""); }, placeholder: "Search articles...",
  } : null, [query, debouncedQuery]));

  const loadArticles = useCallback(async (p: number, reset: boolean) => {
    const data = await fetchArticles(p * PAGE_SIZE, PAGE_SIZE);
    if (!mountedRef.current) return;
    const items = (data as any).data ?? [];
    const pagination = (data as any).pagination;
    setArticles(prev => reset ? items : [...prev, ...items]);
    setHasMore(pagination ? pagination.hasMore : items.length >= PAGE_SIZE);
    setInitialLoading(false);
    setInfiniteLoading(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    mountedRef.current = true;
    loadArticles(0, true);
    return () => { mountedRef.current = false; };
  }, [mounted, loadArticles]);

  useEffect(() => {
    if (!mounted) return;
    return () => {
      sseRef.current.forEach((es) => es.close());
      sseRef.current.clear();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [mounted, query]);

  useEffect(() => {
    if (!mounted) return;
    if (debouncedQuery.trim()) {
      performSearch(debouncedQuery.trim());
    } else {
      setInitialLoading(true);
      setArticles([]);
      setPage(0);
      loadArticles(0, true);
    }
  }, [mounted, debouncedQuery, loadArticles]);

  useEffect(() => {
    if (!mounted) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !infiniteLoading && !initialLoading) {
        setInfiniteLoading(true);
        const nextPage = page + 1;
        loadArticles(nextPage, false);
        setPage(nextPage);
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [mounted, hasMore, infiniteLoading, initialLoading, page, loadArticles]);

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

  function startGenerate(slug: string) {
    const entry: GeneratingEntry = { slug, title: slug.replace(/-/g, " "), phase: "queued", agentEvents: [] };
    setGenerating((prev) => { const next = new Map(prev); next.set(slug, entry); return next; });

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
          setGenerating((prev) => {
            const next = new Map(prev); const e = next.get(slug);
            if (e) next.set(slug, { ...e, phase: "error", error: data.error || "Unknown error" });
            return next;
          });
          es.close(); sseRef.current.delete(slug);
        } else {
          setGenerating((prev) => {
            const next = new Map(prev); const e = next.get(slug);
            if (e) next.set(slug, { ...e, phase: data.status === "paused" ? "paused" : (data.phase || data.status), error: data.status === "paused" ? data.error : undefined });
            return next;
          });
        }
      });

      es.onerror = () => { es.close(); sseRef.current.delete(slug); };
    }).catch((err) => {
      setGenerating((prev) => {
        const next = new Map(prev); const e = next.get(slug);
        if (e) next.set(slug, { ...e, phase: "error", error: String(err) });
        return next;
      });
    });
  }

  const allCategories = Array.from(new Set(articles.flatMap(a => a.categories ?? []))).sort();
  const filteredArticles = selectedCategory
    ? articles.filter(a => a.categories?.includes(selectedCategory))
    : articles;
  const categoryFilterLabel = selectedCategory || "All categories";

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        {/* Search */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)" }}>Articles</h1>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Browse the encyclopedia</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--subtle)" }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles..."
                className="input w-full pl-10 pr-4 py-2.5 text-sm"
                autoFocus
              />
            </div>
            <button
              onClick={() => {
                const slug = slugify(query.trim());
                if (slug && !generating.has(slug)) {
                  fetchArticleStatus(slug).then((existing) => {
                    if (existing && "status" in existing && existing.status === "published") {
                      router.push(`/article/${slug}`);
                    } else {
                      startGenerate(slug);
                    }
                  });
                }
              }}
              className="btn btn-primary btn-sm shrink-0"
              disabled={!query.trim()}
            >
              <IconLightning size={14} /> Generate
            </button>
          </div>
        </div>

        {/* Generating entries */}
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

        {/* Filter bar */}
        {!initialLoading && articles.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <select
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="input text-xs py-1.5 px-2 w-auto"
              style={{ minWidth: 140 }}
            >
              <option value="">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setViewMode("list")} className={`btn-icon btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`} title="List view">
                <IconList size={14} />
              </button>
              <button onClick={() => setViewMode("grid")} className={`btn-icon btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`} title="Grid view">
                <IconGrid size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        {!initialLoading && (
          <div className="text-xs mb-4" style={{ color: "var(--subtle)" }}>
            {searching ? "Searching..." : `${filteredArticles.length} article${filteredArticles.length !== 1 ? "s" : ""}`}
            {selectedCategory ? ` in ${selectedCategory}` : ""}
          </div>
        )}

        {/* Results */}
        {initialLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : filteredArticles.length > 0 ? (
          <>
            {viewMode === "list" ? (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredArticles.map((article) => (
                  <ArticleRow key={article.slug} article={article} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {filteredArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            )}
            <div ref={sentinelRef} className="h-4" />
            {infiniteLoading && (
              <div className="text-center py-4">
                <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="mb-4"><IconSearch size={48} style={{ color: "var(--subtle)" }} /></div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>No articles found</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              {query ? `No results for "${query}". Generate an article about it.` : "Your encyclopedia is empty."}
            </p>
            {query && (
              <button
                onClick={() => {
                  const slug = slugify(query.trim());
                  if (slug) startGenerate(slug);
                }}
                className="btn btn-primary"
              >
                <IconLightning size={16} /> Generate &ldquo;{query}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
