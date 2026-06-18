"use client";

import { useState, useEffect, useMemo } from "react";
import { useMaps, useMapSearch, type MapEntry } from "../hooks";
import { usePageSearch } from "../HeaderSearchContext";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";
import SectionHeader from "../components/SectionHeader";
import MapViewer from "../components/MapViewer";
import { CardGridSkeleton } from "../components/CardSkeleton";
import { IconMap, IconGlobe } from "../components/Icons";

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
    <PageLayout>

      {/* Hero with green wave background */}
      <PageHero
        title="World History Maps"
        subtitle="Explore historical maps spanning civilizations, wars, and empires"
        gradient="green"
      />

      <main className="flex-1 overflow-y-auto max-w-6xl mx-auto w-full px-6 py-6 pb-16">
        {loading ? (
          <CardGridSkeleton />
        ) : (
          <>
            {/* Latest Maps */}
            {maps.length > 0 && (
              <section>
                <SectionHeader icon={IconMap} title="STATIC MAPS" accent="var(--accent)" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {maps.map((map) => (
                    <a
                      key={map.slug}
                      href={`/maps/${map.slug}`}
                      className="glass-card-static p-0 overflow-hidden block"
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
                                fallback.style.background = "linear-gradient(135deg, #dbeafe, #e0f2fe)";
                                fallback.style.color = "var(--subtle)";
                                fallback.textContent = map.title.charAt(0).toUpperCase();
                                t.parentElement.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                            style={{ background: "linear-gradient(135deg, #dbeafe, #e0f2fe)", color: "var(--subtle)" }}>
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
                            <span className="tag tag-subtle text-[10px]" style={{ fontSize: "9px" }}>{map.region}</span>
                          )}
                          {map.era && (
                            <span className="tag tag-subtle text-[10px]" style={{ background: "var(--border-light)", fontSize: "9px" }}>{map.era}</span>
                          )}
                          {map.threedScene && (
                            <span className="tag tag-subtle text-[10px]" style={{ background: "var(--gold)", color: "white", fontSize: "9px" }}>
                              3D
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Search empty state */}
            {maps.length === 0 && !loading && !searching && (
              <div className="text-center py-16">
                <div className="mb-3"><IconMap size={36} /></div>
                <p className="text-sm" style={{ color: "var(--muted)" }}>No maps found for &ldquo;{query}&rdquo;</p>
                <button onClick={() => setQuery("")} className="btn btn-secondary mt-4">
                  Clear search
                </button>
              </div>
            )}

            {/* Interactive Maps */}
            {interactive.length > 0 && (
              <section className="mt-12">
                <SectionHeader icon={IconGlobe} title="INTERACTIVE MAPS" accent="var(--blue)" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {interactive.map((map) => (
                    <a
                      key={map.slug}
                      href={`/maps/${map.slug}`}
                      className="glass-card-static p-0 overflow-hidden block"
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
                            <span className="tag tag-subtle text-[10px]" style={{ fontSize: "9px" }}>{map.region}</span>
                          )}
                          {map.era && (
                            <span className="tag tag-subtle text-[10px]" style={{ background: "var(--border-light)", fontSize: "9px" }}>{map.era}</span>
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
      </main>
    </PageLayout>
  );
}
