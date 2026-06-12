"use client";

import { useState, useEffect } from "react";
import { fetchMap, type MapEntry } from "@/lib/api";
import { mdToHTML } from "@/lib/markdown";
import PageLayout from "../../components/PageLayout";
import MapViewer from "../../components/MapViewer";
import ThreeDMapViewer from "../../components/ThreeDMapViewer";
import InteractiveTimeline from "../../components/InteractiveTimeline";

export default function MapDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [map, setMap] = useState<MapEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  useEffect(() => {
    params.then((p) => {
      setSlug(p.slug);
      fetchMap(p.slug).then((data) => {
        setMap(data);
        setLoading(false);
      });
    });
  }, [params]);

  return (
    <PageLayout>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Breadcrumb */}
        <a href="/maps" className="inline-flex items-center gap-1 text-sm mb-6 transition-colors hover:underline" style={{ color: "var(--orange)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Maps
        </a>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="pixel-card p-4 sm:p-8" style={{ background: "white" }}>
              <div className="w-full h-64 sm:h-80 rounded" style={{ background: "#f1f3f4" }} />
            </div>
            <div className="pixel-card p-4 sm:p-8" style={{ background: "white" }}>
              <div className="h-6 rounded w-2/3 mb-4" style={{ background: "#f1f3f4" }} />
              <div className="h-4 rounded w-1/3 mb-4" style={{ background: "#f1f3f4" }} />
              <div className="space-y-2">
                <div className="h-3 rounded w-full" style={{ background: "#f1f3f4" }} />
                <div className="h-3 rounded w-full" style={{ background: "#f1f3f4" }} />
                <div className="h-3 rounded w-3/4" style={{ background: "#f1f3f4" }} />
              </div>
            </div>
          </div>
        ) : map ? (
          <>
            {/* Map Section */}
            <div className="pixel-card p-4 sm:p-6 md:p-8 mb-8" style={{ background: "white" }}>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🗺</span>
                  <div>
                    <h2 className="pixel text-xs" style={{ color: "var(--ink)" }}>MAP</h2>
                    <div className="h-1 w-12 mt-1" style={{ background: "var(--orange)" }} />
                  </div>
                </div>

                {/* 2D / 3D Toggle */}
                {map.threedScene && (
                  <div className="flex gap-1 border-2 border-black rounded overflow-hidden">
                    <button
                      onClick={() => setViewMode("2d")}
                      className={`px-3 py-1 text-xs font-bold transition-colors ${
                        viewMode === "2d"
                          ? "bg-[var(--orange)] text-white"
                          : "bg-white text-[#5f6368] hover:bg-[#f1f3f4]"
                      }`}
                      style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}
                    >
                      2D
                    </button>
                    <button
                      onClick={() => setViewMode("3d")}
                      className={`px-3 py-1 text-xs font-bold transition-colors ${
                        viewMode === "3d"
                          ? "bg-[var(--orange)] text-white"
                          : "bg-white text-[#5f6368] hover:bg-[#f1f3f4]"
                      }`}
                      style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}
                    >
                      3D
                    </button>
                  </div>
                )}
              </div>

              {viewMode === "3d" && map.threedScene ? (
                <ThreeDMapViewer scene={map.threedScene} height="500px" />
              ) : map.type === "static" && map.image ? (
                <div className="w-full rounded overflow-hidden border border-[#dfe1e5] bg-white">
                  <img
                    src={map.image}
                    alt={map.title}
                    className="w-full h-auto max-h-[500px] object-contain"
                    style={{ background: "#f1f3f4" }}
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = "none";
                      const parent = t.parentElement;
                      if (parent) {
                        const fallback = document.createElement("div");
                        fallback.className = "w-full h-64 flex items-center justify-center text-4xl font-bold";
                        fallback.style.background = "linear-gradient(135deg, #dbeafe, #e0f2fe)";
                        fallback.style.color = "#9aa0a6";
                        fallback.textContent = map.title.charAt(0).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
              ) : map.type === "interactive" ? (
                <MapViewer
                  centerLat={map.centerLat}
                  centerLng={map.centerLng}
                  zoom={map.zoom}
                  markers={map.markers}
                  layers={map.layers}
                  height="500px"
                />
              ) : null}
            </div>

            {/* Title & Meta */}
            <div className="pixel-card p-4 sm:p-6 md:p-8 mb-8" style={{ background: "white" }}>
              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl">📋</span>
                <div>
                  <h2 className="pixel text-xs" style={{ color: "var(--ink)" }}>DETAILS</h2>
                  <div className="h-1 w-12 mt-1" style={{ background: "var(--blue)" }} />
                </div>
              </div>

              <h1 className="pixel text-base sm:text-lg md:text-xl mb-3 leading-snug" style={{ color: "var(--ink)" }}>
                {map.title}
              </h1>

              {map.subtitle && (
                <p className="text-sm mb-4" style={{ color: "#5f6368" }}>{map.subtitle}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-4">
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
                <span className="text-xs ml-auto" style={{ color: "#9aa0a6" }}>
                  Created {new Date(map.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Description */}
            {map.content && (
              <div className="pixel-card p-4 sm:p-6 md:p-8 mb-8" style={{ background: "white" }}>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-3xl">📜</span>
                  <div>
                    <h2 className="pixel text-xs" style={{ color: "var(--ink)" }}>DESCRIPTION</h2>
                    <div className="h-1 w-12 mt-1" style={{ background: "var(--gold)" }} />
                  </div>
                </div>
                <div
                  className="prose leading-relaxed overflow-x-auto break-words"
                  style={{ fontSize: "1.05rem", color: "#222", lineHeight: "1.8" }}
                  dangerouslySetInnerHTML={{ __html: mdToHTML(map.content) }}
                />
              </div>
            )}

            {/* Timeline */}
            {map.timeline && map.timeline.length > 0 && (
              <InteractiveTimeline events={map.timeline} />
            )}

            {/* Related Article CTA */}
            <div className="pixel-card p-4 sm:p-6 md:p-8 mb-8" style={{ background: "#fae8ff" }}>
              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl">🔍</span>
                <div>
                  <h2 className="pixel text-xs" style={{ color: "var(--ink)" }}>RELATED ARTICLES</h2>
                  <div className="h-1 w-12 mt-1" style={{ background: "var(--purple)" }} />
                </div>
              </div>
              <p className="text-sm mb-2" style={{ color: "#1a1a1a" }}>Explore related articles</p>
              <p className="text-xs mb-4" style={{ color: "#5f6368" }}>
                Search for articles related to this map&rsquo;s topic and time period.
              </p>
              <a
                href={`/?q=${encodeURIComponent(map.title.split(",")[0]?.replace(/^Map of (the )?/i, "") || map.region || "")}`}
                className="pixel-btn inline-block"
                style={{ background: "var(--orange)", color: "white", border: "2px solid var(--ink)", textDecoration: "none" }}
              >
                Search Articles →
              </a>
            </div>
          </>
        ) : (
          /* Not found */
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🗺</div>
            <h2 className="pixel text-sm mb-2" style={{ color: "var(--ink)" }}>MAP NOT FOUND</h2>
            <p className="text-sm mb-4" style={{ color: "#5f6368" }}>The map &ldquo;{slug}&rdquo; doesn&rsquo;t exist.</p>
            <a href="/maps" className="pixel-btn inline-block" style={{ background: "white", textDecoration: "none" }}>
              Browse all maps
            </a>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
