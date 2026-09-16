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
  const { widthMode } = useUiMode();

  if (!map) {
    return (
      <div className="py-20 px-6 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto text-xl font-bold">
          🗺
        </div>
        <h1 className="text-xl font-bold text-zinc-900 capitalize">
          {slug.replace(/-/g, " ")}
        </h1>
        <p className="text-xs text-zinc-500">
          This atlas entry does not exist yet in the cartography records.
        </p>
        <Link
          href="/maps"
          className="inline-block px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold text-xs hover:bg-zinc-800 transition-colors no-underline"
        >
          Back to Atlas
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
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-8 transition-all duration-300`}>
        {/* Header */}
        <div className="border-b border-zinc-200 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold text-[11px] uppercase tracking-wider border border-blue-200">
              Spatial Cartography {map.region ? `• ${map.region}` : ""} {map.era ? `• ${map.era}` : ""}
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500 text-xs">Deep-Zoom Historical Atlas</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 leading-[1.1]">
            {title}
          </h1>

          {deck && (
            <p className="font-serif text-lg sm:text-xl text-zinc-700 italic leading-relaxed pt-1">
              {deck}
            </p>
          )}
        </div>

        {/* Map Viewport */}
        {hasMap && (
          <div className="rounded-2xl border border-zinc-200 overflow-hidden shadow-xs bg-zinc-900 h-[480px] sm:h-[560px]">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {map.content && (
            <div className="md:col-span-2 p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Cartographic History & Context
              </h2>
              <div className="font-serif text-zinc-800 leading-relaxed text-base">
                <MarkdownRenderer content={map.content} />
              </div>
            </div>
          )}

          {/* Key Geographic Markers & Timeline */}
          <div className="space-y-6">
            {markers.length > 0 && (
              <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Key Hotspot Markers ({markers.length})
                </h3>
                <ul className="space-y-2 text-xs">
                  {markers.map((m, i) => (
                    <li key={i} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 space-y-0.5">
                      <div className="font-bold text-zinc-900">{m.title}</div>
                      {m.description && <div className="text-zinc-500 text-[11px]">{m.description}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(map.timeline?.length ?? 0) > 0 && (
              <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Chronological Era
                </h3>
                <ol className="space-y-2 text-xs">
                  {map.timeline!.map((t, i) => (
                    <li key={t.id ?? i} className="flex gap-2">
                      <span className="font-mono font-bold text-zinc-900">{t.year}</span>
                      <span className="text-zinc-600">{t.event}</span>
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
