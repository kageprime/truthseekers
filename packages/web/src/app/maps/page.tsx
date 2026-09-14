"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useMaps, useMapSearch } from "../hooks";
import type { MapEntry } from "@encarta/core";
import { usePageSearch } from "../HeaderSearchContext";
import { IconSearch, IconGrid, IconList } from "../components/Icons";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function MapRow({ entry, index }: { entry: MapEntry; index: number }) {
  return (
    <Link
      href={`/maps/${entry.slug}`}
      className="block bg-[var(--r-surface-elevated)] border border-[var(--r-border)] p-3 rounded-[var(--r-radius)] no-underline text-[var(--r-ink)] hover:border-[var(--r-accent)] transition-all shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="text-[11px] font-bold text-[var(--r-muted)] tabular-nums pt-0.5 w-6 shrink-0">{String(index + 1).padStart(2, "0")}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-[var(--r-accent)] leading-snug" style={{ fontFamily: "Georgia, serif" }}>
              {entry.title}
            </span>
            {entry.type === "interactive" && (
              <span className="text-[9px] px-1.5 py-0.5 bg-[var(--r-header-accent)] text-black font-bold rounded-sm border border-black/30">
                INTERACTIVE
              </span>
            )}
          </div>
          <span className="block text-[12px] leading-relaxed mt-1 line-clamp-2 text-[var(--r-ink-secondary)]">
            {entry.subtitle || entry.description || "No description provided."}
          </span>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--r-muted)] flex-wrap">
            {entry.region && (
              <span className="bg-[var(--r-nav-bg)] px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                {entry.region}
              </span>
            )}
            {entry.era && (
              <span className="bg-[var(--r-nav-bg)] px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                {entry.era}
              </span>
            )}
            {(entry.markers?.length ?? 0) > 0 && (
              <span className="tabular-nums">
                {entry.markers!.length} marker{entry.markers!.length !== 1 ? "s" : ""}
              </span>
            )}
            {entry.updatedAt && (
              <span className="ml-auto tabular-nums">
                Updated {new Date(entry.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>
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
  const searching = showSearch && searchQuery.loading;

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

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="border-b border-[var(--r-border)] pb-3">
        <h1 className="r-h1 text-[26px] sm:text-[32px]">Atlas</h1>
        <p className="text-[12px] text-[var(--r-muted)] mt-1">Every mapped article, plotted and explorable.</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] border border-[var(--r-border)]">
        <div className="relative flex-1 min-w-[200px]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search maps by title or keyword..."
            className="w-full bg-[var(--r-surface)] border border-[var(--r-border)] px-3 py-1.5 text-[13px] text-[var(--r-ink)] rounded-[var(--r-radius)] outline-none focus:ring-1 focus:ring-[var(--r-accent)]"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "" | "static" | "interactive")}
          className="bg-[var(--r-surface)] text-[12px] px-2.5 py-1.5 text-[var(--r-ink)] border border-[var(--r-border)] rounded-[var(--r-radius)] outline-none"
        >
          <option value="">All types</option>
          <option value="interactive">Interactive</option>
          <option value="static">Static</option>
        </select>

        {allRegions.length > 0 && (
          <select
            value={selectedRegion ?? ""}
            onChange={(e) => setSelectedRegion(e.target.value || null)}
            className="bg-[var(--r-surface)] text-[12px] px-2.5 py-1.5 text-[var(--r-ink)] border border-[var(--r-border)] rounded-[var(--r-radius)] outline-none"
          >
            <option value="">All Regions ({allRegions.length})</option>
            {allRegions.map((r) => (
              <option key={r} value={r}>{r}</option>
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
          {searching ? "Searching..." : `${filtered.length} map${filtered.length !== 1 ? "s" : ""}`}
          {selectedRegion ? ` in ${selectedRegion}` : ""}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] p-4 rounded-[var(--r-radius)] animate-pulse">
              <div className="h-4 bg-[var(--r-nav-bg)] w-1/2 rounded" />
              <div className="h-3 bg-[var(--r-nav-bg)] w-3/4 mt-2 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {viewMode === "list" ? (
            <div className="space-y-2">
              {filtered.map((entry, i) => (
                <MapRow key={`${entry.slug}-${i}`} entry={entry} index={page * PAGE_SIZE + i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((entry, i) => (
                <MapRow key={`${entry.slug}-${i}`} entry={entry} index={page * PAGE_SIZE + i} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!debouncedQuery.trim() && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="r-btn px-3 py-1.5 disabled:opacity-40"
              >
                ◀ Prev
              </button>
              <span className="text-[12px] font-bold text-[var(--r-muted)] px-3">
                Page {page + 1}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={listed.length < PAGE_SIZE}
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
          <h2 className="text-[16px] font-bold text-[var(--r-accent)] mb-1">No maps found</h2>
          <p className="text-[12px] text-[var(--r-muted)] mb-4">
            {query ? `No matching entries for "${query}". Try a different keyword.` : "The atlas is currently empty."}
          </p>
        </div>
      )}
    </div>
  );
}
