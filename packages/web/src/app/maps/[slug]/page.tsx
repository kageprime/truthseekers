"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMap } from "../../hooks";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import PageLayout from "../../components/PageLayout";
import SectionHeader from "../../components/SectionHeader";
import MapViewer from "../../components/MapViewer";
import ThreeDMapViewer from "../../components/ThreeDMapViewer";
import InteractiveTimeline from "../../components/InteractiveTimeline";
import { IconMap, IconClipboard, IconSearch, IconFileText } from "../../components/Icons";

export default function MapDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const { data: map, loading } = useMap(slug || undefined);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  return (
    <PageLayout>
      <main className="flex-1 overflow-y-auto max-w-6xl mx-auto w-full px-6 py-10">
        {/* Breadcrumb */}
          <Link href="/maps" className="inline-flex items-center gap-1 text-sm mb-6 transition-colors hover:underline" style={{ color: "var(--accent)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Maps
        </Link>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="glass-card-static p-4 sm:p-8 mb-6">
              <div className="w-full h-64 sm:h-80 rounded skeleton" />
            </div>
            <div className="glass-card-static p-4 sm:p-8 mb-6">
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
            <div className="glass-card-static p-4 sm:p-6 md:p-8 mb-8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <IconMap size={28} />
                  <div>
                    <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Map</h2>
                    <div className="h-0.5 w-10 mt-1 rounded-full" style={{ background: "var(--accent)" }} />
                  </div>
                </div>

                {/* 2D / 3D Toggle */}
                {map.threedScene && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setViewMode("2d")}
                      className={`btn btn-sm ${viewMode === "2d" ? "btn-primary" : "btn-secondary"}`}
                    >
                      2D
                    </button>
                    <button
                      onClick={() => setViewMode("3d")}
                      className={`btn btn-sm ${viewMode === "3d" ? "btn-primary" : "btn-secondary"}`}
                    >
                      3D
                    </button>
                  </div>
                )}
              </div>

              {viewMode === "3d" && map.threedScene ? (
                <ThreeDMapViewer scene={map.threedScene} height="clamp(300px, 50vh, 500px)" />
              ) : map.type === "static" && map.image ? (
                <div className="w-full overflow-hidden border-2 border-[var(--border)] bg-[var(--surface-elevated)]">
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
                  height="clamp(300px, 50vh, 500px)"
                />
              ) : null}
            </div>

            {/* Title & Meta */}
            <div className="glass-card-static p-4 sm:p-6 md:p-8 mb-8">
              <SectionHeader icon={IconClipboard} title="Details" accent="var(--blue)" />

              <h1 className="text-lg sm:text-xl font-semibold mb-3 leading-snug" style={{ color: "var(--ink)" }}>
                {map.title}
              </h1>

              {map.subtitle && (
                <p className="text-sm mb-4" style={{ color: "#5f6368" }}>{map.subtitle}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {map.region && (
                  <span className="tag tag-subtle text-xs">{map.region}</span>
                )}
                {map.era && (
                  <span className="tag tag-subtle text-xs">{map.era}</span>
                )}
                {map.threedScene && (
                  <span className="tag tag-subtle text-xs" style={{ background: "var(--gold)", color: "white" }}>
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
              <div className="glass-card-static p-4 sm:p-6 md:p-8 mb-8">
                <SectionHeader icon={IconFileText} title="Description" accent="var(--gold)" />
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
            <div className="glass-card-static p-4 sm:p-6 md:p-8 mb-8" style={{ background: "var(--accent-bg)" }}>
              <SectionHeader icon={IconSearch} title="Related Articles" accent="var(--accent)" />
              <p className="text-sm mb-2" style={{ color: "#1a1a1a" }}>Explore related articles</p>
              <p className="text-xs mb-4" style={{ color: "#5f6368" }}>
                Search for articles related to this map&rsquo;s topic and time period.
              </p>
              <Link
                href={`/?q=${encodeURIComponent(map.title.split(",")[0]?.replace(/^Map of (the )?/i, "") || map.region || "")}`}
                className="btn btn-primary"
               
              >
                Search Articles →
              </Link>
            </div>
          </>
        ) : (
          /* Not found */
          <div className="text-center py-16">
            <div className="mb-3"><IconMap size={36} /></div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>Map not found</h2>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>The map &ldquo;{slug}&rdquo; doesn&rsquo;t exist.</p>
            <Link href="/maps" className="btn btn-secondary">
              Browse all maps
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
