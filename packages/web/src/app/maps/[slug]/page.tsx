"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchMap, type MapEntry } from "@/lib/api";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import PageLayout from "../../components/PageLayout";
import SectionHeader from "../../components/SectionHeader";
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
      <main className="flex-1 overflow-y-auto max-w-6xl mx-auto w-full px-6 py-10">
        {/* Breadcrumb */}
        <Link href="/maps" className="inline-flex items-center gap-1 text-sm mb-6 transition-colors hover:underline" style={{ color: "var(--orange)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Maps
        </Link>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="pixel-card p-4 sm:p-8" style={{ background: "white" }}>
              <div className="w-full h-64 sm:h-80 rounded" style={{ background: "var(--skeleton)" }} />
            </div>
            <div className="pixel-card p-4 sm:p-8" style={{ background: "white" }}>
              <div className="h-6 rounded w-2/3 mb-4" style={{ background: "var(--skeleton)" }} />
              <div className="h-4 rounded w-1/3 mb-4" style={{ background: "var(--skeleton)" }} />
              <div className="space-y-2">
                <div className="h-3 rounded w-full" style={{ background: "var(--skeleton)" }} />
                <div className="h-3 rounded w-full" style={{ background: "var(--skeleton)" }} />
                <div className="h-3 rounded w-3/4" style={{ background: "var(--skeleton)" }} />
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => setViewMode("2d")}
                      className={`btn-sm ${viewMode === "2d" ? "btn-primary" : "btn-secondary"}`}
                    >
                      2D
                    </button>
                    <button
                      onClick={() => setViewMode("3d")}
                      className={`btn-sm ${viewMode === "3d" ? "btn-primary" : "btn-secondary"}`}
                    >
                      3D
                    </button>
                  </div>
                )}
              </div>

              {viewMode === "3d" && map.threedScene ? (
                <ThreeDMapViewer scene={map.threedScene} height="500px" />
              ) : map.type === "static" && map.image ? (
                <div className="w-full overflow-hidden border-2 border-[var(--border)] bg-white">
                  <img
                    src={map.image}
                    alt={map.title}
                    className="w-full h-auto max-h-[500px] object-contain"
                    style={{ background: "var(--skeleton)" }}
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = "none";
                      const parent = t.parentElement;
                      if (parent) {
                        const fallback = document.createElement("div");
                        fallback.className = "w-full h-64 flex items-center justify-center text-4xl font-bold";
                        fallback.style.background = "var(--cream)";
                        fallback.style.color = "var(--ink)";
                        fallback.style.border = "2px solid var(--ink)";
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
              <SectionHeader emoji="📋" title="DETAILS" accent="var(--blue)" />

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
                <SectionHeader emoji="📜" title="DESCRIPTION" accent="var(--gold)" />
                <div
                  className="leading-relaxed overflow-x-auto break-words"
                  style={{ fontSize: "1.05rem", color: "#222", lineHeight: "1.8" }}
                >
                  <MarkdownRenderer content={map.content} />
                </div>
              </div>
            )}

            {/* Timeline */}
            {map.timeline && map.timeline.length > 0 && (
              <InteractiveTimeline events={map.timeline} />
            )}

            {/* Related Article CTA */}
            <div className="pixel-card p-4 sm:p-6 md:p-8 mb-8" style={{ background: "#fae8ff" }}>
              <SectionHeader emoji="🔍" title="RELATED ARTICLES" accent="var(--purple)" />
              <p className="text-sm mb-2" style={{ color: "#1a1a1a" }}>Explore related articles</p>
              <p className="text-xs mb-4" style={{ color: "#5f6368" }}>
                Search for articles related to this map&rsquo;s topic and time period.
              </p>
              <Link
                href={`/?q=${encodeURIComponent(map.title.split(",")[0]?.replace(/^Map of (the )?/i, "") || map.region || "")}`}
                className="btn-primary"
              >
                Search Articles →
              </Link>
            </div>
          </>
        ) : (
          /* Not found */
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🗺</div>
            <h2 className="pixel text-sm mb-2" style={{ color: "var(--ink)" }}>MAP NOT FOUND</h2>
            <p className="text-sm mb-4" style={{ color: "#5f6368" }}>The map &ldquo;{slug}&rdquo; doesn&rsquo;t exist.</p>
            <Link href="/maps" className="btn-secondary">
              Browse all maps
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
