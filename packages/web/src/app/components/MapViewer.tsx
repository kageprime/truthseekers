"use client";

import { useEffect, useRef, useState } from "react";

export interface MapViewerMarker {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  type?: "city" | "battle" | "site" | "museum" | "other";
}

export interface MapViewerLayer {
  id: string;
  label: string;
  year?: number;
  geoJson: object;
  visible?: boolean;
}

interface Props {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  markers?: MapViewerMarker[];
  layers?: MapViewerLayer[];
  className?: string;
  height?: string;
}

const TYPE_ICONS: Record<string, string> = {
  city: "\u{1F3F0}",
  battle: "\u{2694}\u{FE0F}",
  site: "\u{26F0}\u{FE0F}",
  museum: "\u{1F3DB}\u{FE0F}",
  other: "\u{1F30D}",
};

export default function MapViewer({
  centerLat = 30,
  centerLng = 0,
  zoom = 3,
  markers = [],
  layers = [],
  className = "",
  height = "400px",
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const geoJsonLayers = useRef<Map<string, any>>(new Map());
  const initialized = useRef(false);
  const [activeLayerId, setActiveLayerId] = useState<string>(
    layers.find((l) => l.visible)?.id || ""
  );

  useEffect(() => {
    if (!mapContainer.current || initialized.current) return;
    initialized.current = true;
    let cancelled = false;

    const container = mapContainer.current;
    const initMap = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container || (container as any)._leaflet_id) return;

      const map = L.map(container, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      mapInstance.current = map;

      // Add markers
      const ml = L.layerGroup().addTo(map);
      markersLayer.current = ml;

      for (const m of markers) {
        const icon = L.divIcon({
          html: `<div style="font-size:18px;line-height:1;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">${TYPE_ICONS[m.type || "other"]}</div>`,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12],
        });

        const marker = L.marker([m.lat, m.lng], { icon }).bindPopup(
          `<strong>${m.title}</strong>${m.description ? `<br><span style="color:#555;font-size:13px">${m.description}</span>` : ""}`
        );
        ml.addLayer(marker);
      }

      // Add GeoJSON layers
      for (const layer of layers) {
        if (!layer.geoJson) continue;
        const geoLayer = L.geoJSON(layer.geoJson as any, {
          style: () => ({
            fillColor: (layer.geoJson as any).features?.[0]?.properties?.fillColor || "#3388ff",
            fillOpacity: 0.35,
            color: "#333",
            weight: 1.5,
          }),
        });
        geoJsonLayers.current.set(layer.id, geoLayer);
      }

      // Activate initial layer
      const initial = layers.find((l) => l.visible) || layers[0];
      if (initial) {
        const gl = geoJsonLayers.current.get(initial.id);
        if (gl) gl.addTo(map);
        setActiveLayerId(initial.id);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      initialized.current = false;
    };
  }, [centerLat, centerLng, zoom]);

  function switchLayer(layerId: string) {
    const map = mapInstance.current;
    if (!map) return;

    // Remove all GeoJSON layers
    for (const [_, gl] of geoJsonLayers.current) {
      if (map.hasLayer(gl)) map.removeLayer(gl);
    }

    // Add the selected layer
    const gl = geoJsonLayers.current.get(layerId);
    if (gl) gl.addTo(map);

    setActiveLayerId(layerId);
  }

  // Re-add markers if they change (e.g., for future dynamic updates)
  useEffect(() => {
    const map = mapInstance.current;
    const ml = markersLayer.current;
    if (!map || !ml) return;

    ml.clearLayers();
    const loadLeaflet = async () => {
      const L = (await import("leaflet")).default;
      for (const m of markers) {
        const icon = L.divIcon({
          html: `<div style="font-size:18px;line-height:1;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">${TYPE_ICONS[m.type || "other"]}</div>`,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12],
        });
        const marker = L.marker([m.lat, m.lng], { icon }).bindPopup(
          `<strong>${m.title}</strong>${m.description ? `<br><span style="color:#555;font-size:13px">${m.description}</span>` : ""}`
        );
        ml.addLayer(marker);
      }
    };
    loadLeaflet();
  }, [markers]);

  const hasMultipleLayers = layers.length > 1;

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} style={{ height, width: "100%" }} className="rounded-xl border border-[#dfe1e5] z-0" />

      {hasMultipleLayers && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#5f6368]">Period:</span>
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => switchLayer(layer.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeLayerId === layer.id
                  ? "bg-[#0284c7] text-white border-[#0284c7]"
                  : "bg-white text-[#5f6368] border-[#dfe1e5] hover:border-[#0284c7] hover:text-[#0284c7]"
              }`}
            >
              {layer.label}{layer.year ? ` (${layer.year})` : ""}
            </button>
          ))}
        </div>
      )}

      {markers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[#9aa0a6]">
          <span>Legend:</span>
          {Object.entries(TYPE_ICONS).map(([key, icon]) => {
            const count = markers.filter((m) => (m.type || "other") === key).length;
            if (count === 0) return null;
            return (
              <span key={key} className="flex items-center gap-1">
                <span>{icon}</span>
                <span className="capitalize">{key}</span>
                <span>({count})</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
