"use client";

import { useState, useMemo } from "react";
import { useMaps, useMapSearch, type MapEntry } from "../hooks";
import { usePageSearch } from "../HeaderSearchContext";
import ContentCard from "../components/ContentCard";
import MapViewer from "../components/MapViewer";
import { CardGridSkeleton } from "../components/CardSkeleton";

export default function MapsPage() {
  const [query, setQuery] = useState("");
  const { data: allMaps, loading } = useMaps();
  const { data: searchResults, loading: searching } = useMapSearch(query);

  const isSearching = query.trim().length > 0;
  const maps: MapEntry[] = isSearching ? (searchResults ?? []) : (allMaps?.maps ?? []);
  const interactive: MapEntry[] = isSearching ? [] : (allMaps?.interactive ?? []);

  usePageSearch(useMemo(() => ({
    value: query, onChange: setQuery, onSubmit: () => {}, onClear: () => setQuery(""), placeholder: "Search maps..."
  }), [query]));


  return (
    <ContentCard
      header={
        <div className="px-6 py-5 border-b border-border/40">
          <h1 className="text-lg font-bold tracking-tight" style={{ color: "var(--ink)" }}>World History Maps</h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Explore historical maps spanning civilizations, wars, and empires</p>
        </div>
      }
    >
      <div className="p-4 sm:p-6">
        {loading ? (
          <CardGridSkeleton />
        ) : (
          <>
            {maps.length > 0 && (
              <section>
                <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--subtle)" }}>Static Maps</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {maps.map((map) => (
                    <a
                      key={map.slug}
                      href={`/maps/${map.slug}`}
                      className="block rounded-xl overflow-hidden border border-border/40 bg-surface hover:border-accent/30 transition-colors"
                    >
                      <div className="w-full h-32 overflow-hidden" style={{ background: "var(--skeleton)" }}>
                        {map.image ? (
                          <img
                            src={map.image}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              if (t.parentElement) {
                                const fallback = document.createElement("div");
                                fallback.className = "w-full h-full flex items-center justify-center text-2xl font-bold";
                                fallback.style.background = "linear-gradient(135deg, var(--accent-bg), var(--surface-elevated))";
                                fallback.style.color = "var(--subtle)";
                                fallback.textContent = map.title.charAt(0).toUpperCase();
                                t.parentElement.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                            style={{ background: "linear-gradient(135deg, var(--accent-bg), var(--surface-elevated))", color: "var(--subtle)" }}>
                            {map.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-xs font-medium mb-1" style={{ color: "var(--ink)" }}>
                          {map.title}
                        </h3>
                        {map.subtitle && (
                          <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{map.subtitle}</p>
                        )}
                        <p className="text-xs line-clamp-2 leading-relaxed mt-1" style={{ color: "var(--muted)" }}>{map.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {map.region && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)", color: "var(--subtle)" }}>{map.region}</span>
                          )}
                          {map.era && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)", color: "var(--subtle)" }}>{map.era}</span>
                          )}
                          {map.threedScene && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--gold)", color: "white" }}>3D</span>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {maps.length === 0 && !loading && !searching && (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: "var(--muted)" }}>No maps found for &ldquo;{query}&rdquo;</p>
                <button onClick={() => setQuery("")} className="btn btn-secondary mt-4 cursor-pointer">
                  Clear search
                </button>
              </div>
            )}

            {interactive.length > 0 && (
              <section className="mt-10">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--subtle)" }}>Interactive Maps</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {interactive.map((map) => (
                    <a
                      key={map.slug}
                      href={`/maps/${map.slug}`}
                      className="block rounded-xl overflow-hidden border border-border/40 bg-surface hover:border-accent/30 transition-colors"
                    >
                      <div className="pointer-events-none">
                        <MapViewer
                          centerLat={map.centerLat}
                          centerLng={map.centerLng}
                          zoom={map.zoom}
                          markers={map.markers}
                          layers={map.layers}
                          height="180px"
                        />
                      </div>
                      <div className="p-3">
                        <h3 className="text-xs font-medium mb-1" style={{ color: "var(--ink)" }}>
                          {map.title}
                        </h3>
                        <p className="text-xs line-clamp-2 mt-1" style={{ color: "var(--muted)" }}>{map.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {map.region && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)", color: "var(--subtle)" }}>{map.region}</span>
                          )}
                          {map.era && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)", color: "var(--subtle)" }}>{map.era}</span>
                          )}
                          <span className="text-xs ml-auto" style={{ color: "var(--accent)" }}>INTERACTIVE →</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ContentCard>
  );
}
