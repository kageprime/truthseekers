"use client";

import { useState, useEffect } from "react";
import { fetchMaps, searchMaps, type MapEntry } from "@/lib/api";
import PageLayout from "../components/PageLayout";
import PageHero from "../components/PageHero";
import SectionHeader from "../components/SectionHeader";
import MapViewer from "../components/MapViewer";
import { CardGridSkeleton } from "../components/CardSkeleton";

export default function MapsPage() {
  const [maps, setMaps] = useState<MapEntry[]>([]);
  const [interactive, setInteractive] = useState<MapEntry[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaps().then((data) => {
      setMaps(data.maps);
      setInteractive(data.interactive);
      setLoading(false);
    });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      const data = await fetchMaps();
      setMaps(data.maps);
      setInteractive(data.interactive);
      return;
    }
    setSearching(true);
    const results = await searchMaps(q);
    setMaps(results);
    setInteractive([]);
    setSearching(false);
  }

  function handleClear() {
    setQuery("");
    fetchMaps().then((data) => {
      setMaps(data.maps);
      setInteractive(data.interactive);
    });
  }

  return (
    <PageLayout>
      {/* Search bar */}
      <div className="max-w-6xl mx-auto w-full px-6 py-4">
        <form onSubmit={handleSearch} className="max-w-2xl">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "#9aa0a6" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search maps..."
                className="w-full pixel-input"
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>
            <button type="submit" disabled={searching} className="btn-primary shrink-0">
              {searching ? "..." : "Search"}
            </button>
            {query && (
              <button type="button" onClick={handleClear} className="btn-secondary shrink-0">
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

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
                <SectionHeader emoji="🗺" title="STATIC MAPS" accent="var(--orange)" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {maps.map((map) => (
                    <a
                      key={map.slug}
                      href={`/maps/${map.slug}`}
                      className="pixel-card-sm p-0 overflow-hidden block"
                      style={{ background: "white" }}
                    >
                      <div className="w-full h-32 overflow-hidden" style={{ background: "#f1f3f4" }}>
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
                                fallback.style.color = "#9aa0a6";
                                fallback.textContent = map.title.charAt(0).toUpperCase();
                                t.parentElement.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                            style={{ background: "linear-gradient(135deg, #dbeafe, #e0f2fe)", color: "#9aa0a6" }}>
                            {map.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="pixel text-[10px] mb-1" style={{ color: "#1a1a1a" }}>
                          {map.title}
                        </h3>
                        {map.subtitle && (
                          <p className="text-[11px] truncate" style={{ color: "#5f6368" }}>{map.subtitle}</p>
                        )}
                        <p className="text-xs line-clamp-2 leading-relaxed mt-1" style={{ color: "#5f6368" }}>{map.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {map.region && (
                            <span className="pixel-tag text-[10px]" style={{ fontSize: "9px" }}>{map.region}</span>
                          )}
                          {map.era && (
                            <span className="pixel-tag text-[10px]" style={{ background: "var(--ice)", fontSize: "9px" }}>{map.era}</span>
                          )}
                          {map.threedScene && (
                            <span className="pixel-tag text-[10px]" style={{ background: "var(--gold)", color: "white", fontSize: "9px" }}>
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
                <div className="text-4xl mb-3">🗺</div>
                <p className="text-sm" style={{ color: "#5f6368" }}>No maps found for &ldquo;{query}&rdquo;</p>
                <button onClick={handleClear} className="btn-secondary mt-4">
                  Clear search
                </button>
              </div>
            )}

            {/* Interactive Maps */}
            {interactive.length > 0 && (
              <section className="mt-12">
                <SectionHeader emoji="🌍" title="INTERACTIVE MAPS" accent="var(--blue)" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {interactive.map((map) => (
                    <a
                      key={map.slug}
                      href={`/maps/${map.slug}`}
                      className="pixel-card-sm p-0 overflow-hidden block"
                      style={{ background: "white" }}
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
                        <h3 className="pixel text-[10px] mb-1" style={{ color: "#1a1a1a" }}>
                          {map.title}
                        </h3>
                        <p className="text-xs line-clamp-2 mt-1" style={{ color: "#5f6368" }}>{map.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {map.region && (
                            <span className="pixel-tag text-[10px]" style={{ fontSize: "9px" }}>{map.region}</span>
                          )}
                          {map.era && (
                            <span className="pixel-tag text-[10px]" style={{ background: "var(--ice)", fontSize: "9px" }}>{map.era}</span>
                          )}
                          <span className="pixel text-[8px] ml-auto" style={{ color: "var(--orange)" }}>INTERACTIVE →</span>
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
