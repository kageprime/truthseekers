"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMap } from "../../hooks";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import type { MapEntry } from "@encarta/core";
import { useUiMode } from "../../context/UiModeContext";

const MapViewer = dynamic(() => import("../../components/MapViewer"), { ssr: false });

interface MapClientProps {
  slug: string;
  map: MapEntry | null;
}

export default function MapClient({ slug, map: initialMap }: MapClientProps) {
  const router = useRouter();
  const { data: fetched } = useMap(slug);
  const map: MapEntry | null = initialMap ?? fetched ?? null;
  const { widthMode, alignClass } = useUiMode();

  if (!map) {
    return (
      <div className="py-20 px-6 max-w-md mx-auto text-center space-y-4">
        <div className="font-display text-4xl text-gold">❦</div>
        <h1 className="font-display text-2xl font-bold text-ink capitalize">
          {slug.replace(/-/g, " ")}
        </h1>
        <p className="font-serif italic text-muted">
          This atlas entry does not exist yet in the cartography records.
        </p>
        <Link
          href="/maps"
          className="category-link no-underline text-sm font-semibold"
        >
          Back to atlas →
        </Link>
      </div>
    );
  }

  const layers = map.layers ?? (map.geoJson ? [{ id: "main", label: map.title, geoJson: map.geoJson, visible: true }] : []);
  const markers = map.markers ?? [];
  const hasMap = markers.length > 0 || layers.length > 0 || map.centerLat != null;
  const title = map.title || slug.replace(/-/g, " ");
  const deck = map.subtitle || map.description;

  const containerClass = widthMode === "expanded" ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} ${alignClass} transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Spatial cartography{map.region ? ` · ${map.region}` : ""}{map.era ? ` · ${map.era}` : ""}</span>
            <span>Historical atlas</span>
          </div>
          <h1 className="plate-title">{title}</h1>
          {deck && <p className="plate-deck">{deck}</p>}
          <div className="plate-rule" />
        </div>

        {/* Map Viewport */}
        {hasMap && (
          <div className="border border-rule rounded-sharp overflow-hidden bg-ink h-[480px] sm:h-[560px]">
            <MapViewer
              markers={markers}
              layers={layers}
              centerLat={map.centerLat}
              centerLng={map.centerLng}
              zoom={map.zoom}
              height="100%"
            />
          </div>
        )}

        {/* Narrative & Markers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
          {map.content && (
            <div className="md:col-span-2 space-y-4">
              <h2 className="font-display text-2xl font-bold text-ink">
                History & context
              </h2>
              <div className="t-body text-ink-secondary">
                <MarkdownRenderer content={map.content} />
              </div>
            </div>
          )}

          {/* Key Geographic Markers & Timeline */}
          <div className="space-y-6">
            {markers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                  Hotspots ({markers.length})
                </h3>
                <ul className="ledger">
                  {markers.map((m, i) => (
                    <li key={i} className="ledger-row">
                      <span className="index-numeral">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink text-sm">{m.title}</span>
                        {m.description && <span className="block text-muted text-xs mt-0.5">{m.description}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(map.timeline?.length ?? 0) > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                  Chronology
                </h3>
                <ol className="ledger">
                  {map.timeline!.map((t, i) => (
                    <li key={t.id ?? i} className="ledger-row">
                      <span className="index-numeral">{t.year}</span>
                      <span className="text-sm text-ink-secondary">{t.event}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
