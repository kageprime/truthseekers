"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useMaps, useMapSearch } from "../hooks";
import type { MapEntry } from "@encarta/core";
import { usePageSearch } from "../HeaderSearchContext";
import { useUiMode } from "../context/UiModeContext";
import { IconSearch, IconGrid, IconList } from "../components/Icons";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function MapRow({ entry, index }: { entry: MapEntry; index: number }) {
  return (
    <Link href={`/maps/${entry.slug}`} className="ledger-row group">
      <span className="index-numeral">{String(index + 1).padStart(2, "0")}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-lg font-semibold text-ink group-hover:text-gold transition-colors leading-snug">
            {entry.title}
          </span>
          {entry.type === "interactive" && (
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-gold">
              Interactive
            </span>
          )}
        </span>
        <span className="block text-[13px] leading-relaxed mt-0.5 line-clamp-2 text-muted">
          {entry.subtitle || entry.description || "No description provided."}
        </span>
        <span className="flex items-center gap-3 mt-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-subtle flex-wrap">
          {entry.region && <span>{entry.region}</span>}
          {entry.era && <span>{entry.era}</span>}
          {(entry.markers?.length ?? 0) > 0 && (
            <span className="tabular-nums">
              {entry.markers!.length} marker{entry.markers!.length !== 1 ? "s" : ""}
            </span>
          )}
          {entry.updatedAt && (
            <span className="ml-auto tabular-nums normal-case tracking-normal">
              Updated {new Date(entry.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </span>
          )}
        </span>
      </span>
      <span className="text-subtle group-hover:text-gold transition-colors shrink-0" aria-hidden>›</span>
    </Link>
  );
}

export default function MapsPage() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [typeFilter, setTypeFilter] = useState<"" | "static" | "interactive">("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { widthMode } = useUiMode();
  const inputRef = useRef<HTMLInputElement>(null);

  const showSearch = debouncedQuery.trim().length > 0;
  const mapsQuery = useMaps(PAGE_SIZE, showSearch ? 0 : page * PAGE_SIZE);
  const searchQuery = useMapSearch(showSearch ? debouncedQuery.trim() : "");

  const listed: MapEntry[] = useMemo(() => {
    const d = mapsQuery.data;
    if (!d) return [];
    return [...(d.maps ?? []), ...(d.interactive ?? [])];
  }, [mapsQuery.data]);
  const searched: MapEntry[] = searchQuery.data ?? [];
  const entries: MapEntry[] = showSearch ? searched : listed;
  const loading = showSearch ? searchQuery.loading : mapsQuery.loading;

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

  usePageSearch(query ? { value: query, onChange: handleQueryChange, onSubmit: (e) => e.preventDefault(), placeholder: "Search maps..." } : null);

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    listed.forEach((m) => { if (m.region) set.add(m.region); });
    return Array.from(set).sort();
  }, [listed]);

  const filtered = useMemo(() => {
    return entries.filter((m) => {
      if (typeFilter && m.type !== typeFilter) return false;
      if (selectedRegion && m.region !== selectedRegion) return false;
      return true;
    });
  }, [entries, typeFilter, selectedRegion]);

  if (!mounted) return null;

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} mx-auto transition-all duration-300`}>
      <div className="plate-head">
        <div className="plate-folio">
          <span>Historical atlas</span>
          <span>{!loading ? `${filtered.length} charted` : "Surveying"}</span>
        </div>
        <h1 className="plate-title">Atlas</h1>
        <p className="plate-deck">Every mapped article, plotted and explorable.</p>
        <div className="plate-rule" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-[200px] border-b-2 border-ink pb-2 focus-within:border-gold transition-colors">
          <span className="text-subtle text-lg leading-none" aria-hidden>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search maps by title or keyword…"
            aria-label="Search maps"
            className="flex-1 bg-transparent border-none outline-none font-serif text-lg text-ink placeholder:text-subtle min-w-0"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "" | "static" | "interactive")}
          aria-label="Filter by type"
          className="bg-transparent text-xs text-muted border-b border-border-light pb-1 outline-none cursor-pointer"
        >
          <option value="">All types</option>
          <option value="interactive">Interactive</option>
          <option value="static">Static</option>
        </select>

        {allRegions.length > 0 && (
          <select
            value={selectedRegion ?? ""}
            onChange={(e) => setSelectedRegion(e.target.value || null)}
            aria-label="Filter by region"
            className="bg-transparent text-xs text-muted border-b border-border-light pb-1 outline-none cursor-pointer"
          >
            <option value="">All regions ({allRegions.length})</option>
            {allRegions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs font-mono uppercase tracking-wider">
          <button
            onClick={() => setViewMode("grid")}
            className={`cursor-pointer transition-colors ${viewMode === "grid" ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4" : "text-subtle hover:text-ink"}`}
            title="Grid view"
            aria-pressed={viewMode === "grid"}
          >
            <IconGrid size={13} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`cursor-pointer transition-colors ${viewMode === "list" ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4" : "text-subtle hover:text-ink"}`}
            title="List view"
            aria-pressed={viewMode === "list"}
          >
            <IconList size={13} />
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="py-8 space-y-0 ledger" aria-label="Loading maps">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ledger-row">
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 skeleton w-1/2" />
                <div className="h-3 skeleton w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {viewMode === "list" ? (
            <div className="ledger">
              {filtered.map((entry, i) => (
                <MapRow key={`${entry.slug}-${i}`} entry={entry} index={page * PAGE_SIZE + i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {filtered.map((entry, i) => (
                <div key={`${entry.slug}-${i}`} className="border-b border-border-light">
                  <MapRow entry={entry} index={page * PAGE_SIZE + i} />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!debouncedQuery.trim() && (
            <div className="mt-6 flex items-center justify-between text-xs text-muted">
              <span className="font-mono tabular-nums">Page {page + 1}</span>
              <div className="flex gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="category-link no-underline cursor-pointer disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={listed.length < PAGE_SIZE}
                  className="category-link no-underline cursor-pointer disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto mb-3 text-gold flex justify-center">
            <IconSearch size={28} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-1">No maps found</h2>
          <p className="font-serif italic text-muted">
            {query ? `No matching entries for "${query}". Try a different keyword.` : "The atlas is currently empty."}
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
