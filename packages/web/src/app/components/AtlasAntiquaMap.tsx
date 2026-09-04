"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { CONTINENTS, type ContinentOutline } from "./continent-data";
import SiteViewer3D from "./SiteViewer3D";
import PanoramaViewer from "./PanoramaViewer";

// ─── Types ───────────────────────────────────────────────────────────

export interface AtlasSite {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  era: string;
  desc: string;
  artifacts: string[];
  nigerian?: boolean;
  zamani?: string;
}

interface RenderState {
  centerLon: number;
  centerLat: number;
  zoom: number;
  w: number;
  h: number;
}

// ─── Site data ───────────────────────────────────────────────────────

const SITES: AtlasSite[] = [
  { id: "sukur", name: "Sukur Cultural Landscape", country: "Nigeria", lat: 10.7419, lon: 13.5714, era: "16th c. – present", desc: "Terraced Mandara Mountains kingdom. The Hidi's palace crowns the hill amid sacred baobabs and dry-stone terraces.", artifacts: ["Hidi Palace terraces", "Dry-stone walls", "Iron smelting shrines"], nigerian: true, zamani: "Zamani Project 2017: Complete LiDAR & photogrammetry of palace, terraces, and ritual sites." },
  { id: "benin", name: "Benin City Walls & Moat", country: "Nigeria", lat: 6.335, lon: 5.6037, era: "c.800 – 1897 CE", desc: "The Iya earthworks once encircled 6,500km² — the world's largest pre-mechanical earthwork.", artifacts: ["Benin Bronzes", "16,000km of walls", "Ivory carvings"], nigerian: true, zamani: "Zamani Project 2020: 3D scan of surviving walls, moats, and palace foundations." },
  { id: "nok", name: "Nok Culture – Taruga", country: "Nigeria", lat: 9.6123, lon: 7.8945, era: "900 BCE – 200 CE", desc: "West Africa's earliest sculptural tradition. Life-size terracottas reveal a complex iron-age society.", artifacts: ["Terracotta heads", "Early blast furnaces", "Stone axes"], nigerian: true, zamani: "Nok village oral traditions recorded alongside archaeological surveys." },
  { id: "giza", name: "Pyramids of Giza", country: "Egypt", lat: 29.9792, lon: 31.1342, era: "2580–2510 BCE", desc: "Last Wonder of the Ancient World. Khufu, Khafre, Menkaure align to Orion's belt.", artifacts: ["Great Pyramid", "Great Sphinx", "Solar barque"] },
  { id: "zimbabwe", name: "Great Zimbabwe", country: "Zimbabwe", lat: -20.2676, lon: 30.9335, era: "1100–1450 CE", desc: "Shona stone city built without mortar. Great Enclosure walls rise 11m.", artifacts: ["Soapstone Zimbabwe Birds", "Conical tower", "Gold beads"] },
  { id: "carthage", name: "Carthage", country: "Tunisia", lat: 36.8528, lon: 10.3233, era: "814 – 146 BCE", desc: "Phoenician maritime empire, rival of Rome.", artifacts: ["Punic ports", "Tophet stelae", "Byrsa Hill"] },
  { id: "lalibela", name: "Lalibela Churches", country: "Ethiopia", lat: 12.0317, lon: 39.0411, era: "12th–13th c.", desc: "11 churches hewn top-down from living tuff.", artifacts: ["Bete Giyorgis", "Trench tunnels", "Processional crosses"] },
  { id: "timbuktu", name: "Timbuktu", country: "Mali", lat: 16.7739, lon: -3.0074, era: "12th c. onward", desc: "Saharan manuscript city. Sankore University held 700,000 manuscripts.", artifacts: ["Sankore manuscripts", "Djinguereber Mosque", "Salt ledgers"] },
  { id: "meroe", name: "Meroë Pyramids", country: "Sudan", lat: 16.9381, lon: 33.7496, era: "720 BCE – 350 CE", desc: "Kushite royal necropolis with 200+ steep pyramids.", artifacts: ["Nubian pyramids", "Iron slag mounds", "Royal chapels"] },
  { id: "leptis", name: "Leptis Magna", country: "Libya", lat: 32.6391, lon: 14.29, era: "7th c BCE – 3rd c CE", desc: "Birthplace of Emperor Septimius Severus.", artifacts: ["Severan Forum", "Hunting Baths", "Amphitheatre"] },
  { id: "mapungubwe", name: "Mapungubwe Hill", country: "South Africa", lat: -22.2119, lon: 29.3008, era: "1075–1220 CE", desc: "First class-based society in southern Africa.", artifacts: ["Golden rhinoceros", "Divining bowl", "Glass beads"] },
  { id: "axum", name: "Axum Obelisks", country: "Ethiopia", lat: 14.1291, lon: 38.7199, era: "100–940 CE", desc: "Kingdom of Aksum raised 24m granite stelae.", artifacts: ["Stele of Ezana", "Trilingual inscriptions", "Tomb of the False Door"] },
  { id: "djenne", name: "Djenne-Djenno", country: "Mali", lat: 13.9053, lon: -4.5537, era: "250 BCE – 900 CE", desc: "Oldest urban mound in sub-Saharan Africa.", artifacts: ["Terracotta figures", "Urban mounds", "Iron tools"] },
  { id: "kilwa", name: "Kilwa Kisiwani", country: "Tanzania", lat: -8.9596, lon: 39.517, era: "9th–16th c.", desc: "Swahili coral-stone sultanate controlling gold from Zimbabwe to China.", artifacts: ["Husuni Kubwa Palace", "Great Mosque", "Chinese porcelain"] },
  { id: "kerma", name: "Kerma", country: "Sudan", lat: 19.6035, lon: 30.4088, era: "2500–1500 BCE", desc: "First Nubian kingdom. Massive Western Deffufa temple.", artifacts: ["Western Deffufa", "Tumulus graves", "Blue faience"] },
];

// ─── 360° Panorama data ─────────────────────────────────────────────

interface PanoramaHotspot {
  id: string;
  position: [number, number, number];
  label: string;
  description?: string;
}

const PANORAMA_URL: Record<string, string> = {
  // ponytail: placeholder equirectangular photo — swap with real site
  // panoramas (Zamani Project, AI-generated, or captured) per site ID.
  default: "https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg",
};

const PANORAMA_HOTSPOTS: Record<string, PanoramaHotspot[]> = {
  giza: [
    { id: "pyramid", position: [0, 10, -200], label: "Great Pyramid", description: "Khufu's pyramid — 146m tall, 2.3M limestone blocks" },
    { id: "sphinx", position: [-200, 5, 150], label: "Great Sphinx", description: "73m long, 20m high. Oldest known monumental sculpture" },
    { id: "khafre", position: [200, 10, -150], label: "Pyramid of Khafre", description: "Appears taller due to elevated foundation" },
  ],
  default: [
    { id: "north", position: [0, 0, -300], label: "North", description: "Panoramic view facing north" },
    { id: "east", position: [300, 0, 0], label: "East", description: "Panoramic view facing east" },
    { id: "south", position: [0, 0, 300], label: "South", description: "Panoramic view facing south" },
    { id: "west", position: [-300, 0, 0], label: "West", description: "Panoramic view facing west" },
  ],
};

// ─── Projection ─────────────────────────────────────────────────────

function scaleX(state: RenderState) { return state.w / 360 * state.zoom; }
function scaleY(state: RenderState) { return state.h / 180 * state.zoom; }

function project(lon: number, lat: number, state: RenderState): [number, number] | null {
  const sx = scaleX(state);
  const sy = scaleY(state);
  const x = state.w / 2 + (lon - state.centerLon) * sx;
  const y = state.h / 2 - (lat - state.centerLat) * sy;
  return [x, y];
}

function unproject(px: number, py: number, state: RenderState): [number, number] {
  const sx = scaleX(state);
  const sy = scaleY(state);
  const lon = (px - state.w / 2) / sx + state.centerLon;
  const lat = (state.h / 2 - py) / sy + state.centerLat;
  return [lon, lat];
}

// ─── Deterministic noise for brushstroke ────────────────────────────

function hash(x: number, y: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function precomputeNoise(continents: ContinentOutline[], amp: number): Map<string, [number, number][]> {
  const map = new Map<string, [number, number][]>();
  for (const c of continents) {
    const offsets: [number, number][] = [];
    for (let i = 0; i < c.points.length; i++) {
      const [lon, lat] = c.points[i];
      const dx = (hash(lon + i * 0.7, lat + i * 1.3) * 2 - 1) * amp;
      const dy = (hash(lon * 1.1 + i * 2.1, lat * 0.9 + i * 0.5) * 2 - 1) * amp;
      offsets.push([dx, dy]);
    }
    map.set(c.name, offsets);
  }
  return map;
}

// ─── Easing ──────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Component ───────────────────────────────────────────────────────

interface Props {
  focusSlug?: string;
}

export default function AtlasAntiquaMap({ focusSlug }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rs = useRef<RenderState>({ centerLon: 10, centerLat: 10, zoom: 1, w: 0, h: 0 });
  const noiseOffsets = useRef<Map<string, [number, number][]>>(new Map());
  const dragRef = useRef<{ startX: number; startY: number; clon: number; clat: number } | null>(null);
  const animRef = useRef<number>(0);
  const flyRef = useRef<{ slon: number; slat: number; szoom: number; dlon: number; dlat: number; dzoom: number; t: number } | null>(null);
  const renderScheduled = useRef(false);

  const [selectedSite, setSelectedSite] = useState<AtlasSite | null>(null);
  const [exploringSite, setExploringSite] = useState<AtlasSite | null>(null);
  const [panorama360, setPanorama360] = useState<AtlasSite | null>(null);
  const [parchment, setParchment] = useState(true);

  noiseOffsets.current = precomputeNoise(CONTINENTS, 0.5);

  // ── resize ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cvs = canvas;
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      rs.current.w = w;
      rs.current.h = h;
      scheduleRender();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── auto-focus ──
  useEffect(() => {
    if (focusSlug) {
      const site = SITES.find((s) => s.id === focusSlug);
      if (site) {
        setTimeout(() => {
          startFly(site.lon, site.lat, 8);
          setSelectedSite(site);
        }, 300);
      }
    }
  }, [focusSlug]);

  // ── schedule render ──
  const scheduleRender = useCallback(() => {
    if (renderScheduled.current) return;
    renderScheduled.current = true;
    requestAnimationFrame(() => {
      renderScheduled.current = false;
      render();
    });
  }, []);

  // ── fly-to ──
  function startFly(lon: number, lat: number, zoom: number) {
    flyRef.current = {
      slon: rs.current.centerLon,
      slat: rs.current.centerLat,
      szoom: rs.current.zoom,
      dlon: lon,
      dlat: lat,
      dzoom: zoom,
      t: 0,
    };
    if (!animRef.current) animate();
  }

  // ── render ──
  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = rs.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const parchmentBg = "#e4d5b0";
    ctx.fillStyle = parchmentBg;
    ctx.fillRect(0, 0, state.w, state.h);

    // Grid lines
    ctx.strokeStyle = "#b8a888";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.35;
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project(lon, 0, state) ?? [0, 0];
      if (x < -10 || x > state.w + 10) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.h);
      ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const [, y] = project(0, lat, state) ?? [0, 0];
      if (y < -10 || y > state.h + 10) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Equator & prime meridian, slightly bolder
    ctx.strokeStyle = "#9a8a6a";
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.25;
    const [, ey] = project(0, 0, state) ?? [0, 0];
    ctx.beginPath(); ctx.moveTo(0, ey); ctx.lineTo(state.w, ey); ctx.stroke();
    const [px] = project(0, 0, state) ?? [0, 0];
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, state.h); ctx.stroke();
    ctx.globalAlpha = 1;

    // Continents
    for (const outline of CONTINENTS) {
      drawContinent(ctx, outline, state, noiseOffsets.current, parchment);
    }

    // Compass rose — bottom-left corner (game HUD style)
    const compassX = 56;
    const compassY = state.h - 56;
    drawCompass(ctx, compassX, compassY, 22);

    // Site markers
    for (const site of SITES) {
      drawMarker(ctx, site, state, selectedSite?.id === site.id);
    }

    // Selection glow on marker
    if (selectedSite) {
      const p = project(selectedSite.lon, selectedSite.lat, state);
      if (p) {
        const [mx, my] = p;
        ctx.beginPath();
        ctx.arc(mx, my - 28, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#d4a257";
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ── animation loop ──
  function animate() {
    const fly = flyRef.current;
    if (fly) {
      fly.t += 0.025;
      if (fly.t >= 1) {
        fly.t = 1;
        rs.current.centerLon = fly.dlon;
        rs.current.centerLat = fly.dlat;
        rs.current.zoom = fly.dzoom;
        flyRef.current = null;
      } else {
        const e = easeInOut(fly.t);
        rs.current.centerLon = fly.slon + (fly.dlon - fly.slon) * e;
        rs.current.centerLat = fly.slat + (fly.dlat - fly.slat) * e;
        rs.current.zoom = fly.szoom + (fly.dzoom - fly.szoom) * e;
      }
      scheduleRender();
    }
    animRef.current = fly || dragRef.current ? requestAnimationFrame(animate) : 0;
  }

  // ── input handlers (via effect so wheel/touch can be non-passive) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let drag: { startX: number; startY: number; clon: number; clat: number } | null = null;
    let touchDist = 0;

    function mousedown(e: MouseEvent) {
      drag = { startX: e.clientX, startY: e.clientY, clon: rs.current.centerLon, clat: rs.current.centerLat };
      (canvas as any).style.cursor = "grabbing";
      if (!animRef.current) animate();
    }
    function mousemove(e: MouseEvent) {
      if (!drag) return;
      const sx = scaleX(rs.current), sy = scaleY(rs.current);
      rs.current.centerLon = drag.clon - (e.clientX - drag.startX) / sx;
      rs.current.centerLat = drag.clat + (e.clientY - drag.startY) / sy;
      scheduleRender();
    }
    function mouseup(e: MouseEvent) {
      (canvas as any).style.cursor = "grab";
      const d = drag;
      drag = null;
      if (!d) return;
      if (Math.abs(e.clientX - d.startX) < 5 && Math.abs(e.clientY - d.startY) < 5) handleClick(e.clientX, e.clientY);
      if (!flyRef.current && !drag) animRef.current = 0;
    }

    function handleClick(cx: number, cy: number) {
      for (const site of SITES) {
        const p = project(site.lon, site.lat, rs.current);
        if (!p) continue;
        if (Math.sqrt((cx - p[0]) ** 2 + (cy - p[1]) ** 2) < 22) {
          startFly(site.lon, site.lat, 8);
          setSelectedSite(site);
          return;
        }
      }
    }

    function wheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.88 : 1 / 0.88;
      const nz = Math.min(Math.max(rs.current.zoom * factor, 0.3), 40);
      const mx = e.clientX, my = e.clientY;
      const [lon, lat] = unproject(mx, my, rs.current);
      rs.current.zoom = nz;
      const [nx, ny] = project(lon, lat, rs.current) ?? [mx, my];
      const sx = scaleX(rs.current), sy = scaleY(rs.current);
      rs.current.centerLon -= (nx - mx) / sx;
      rs.current.centerLat += (ny - my) / sy;
      scheduleRender();
    }

    function touchstart(e: TouchEvent) {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        drag = { startX: t.clientX, startY: t.clientY, clon: rs.current.centerLon, clat: rs.current.centerLat };
        if (!animRef.current) animate();
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }

    function touchmove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 1 && drag) {
        const t = e.touches[0];
        const sx = scaleX(rs.current), sy = scaleY(rs.current);
        rs.current.centerLon = drag.clon - (t.clientX - drag.startX) / sx;
        rs.current.centerLat = drag.clat + (t.clientY - drag.startY) / sy;
        scheduleRender();
      } else if (e.touches.length === 2 && touchDist > 0) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const factor = dist / touchDist;
        touchDist = dist;
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const [lon, lat] = unproject(mx, my, rs.current);
        rs.current.zoom = Math.min(Math.max(rs.current.zoom * factor, 0.3), 40);
        const [nx, ny] = project(lon, lat, rs.current) ?? [mx, my];
        const sx = scaleX(rs.current), sy = scaleY(rs.current);
        rs.current.centerLon -= (nx - mx) / sx;
        rs.current.centerLat += (ny - my) / sy;
        scheduleRender();
      }
    }

    function touchend(e: TouchEvent) {
      if (e.changedTouches.length === 1 && drag) {
        const t = e.changedTouches[0];
        const d = drag;
        drag = null;
        touchDist = 0;
        if (Math.abs(t.clientX - d.startX) < 5 && Math.abs(t.clientY - d.startY) < 5) handleClick(t.clientX, t.clientY);
      } else {
        drag = null;
        touchDist = 0;
      }
      if (!flyRef.current && !drag) animRef.current = 0;
    }

    canvas.addEventListener("mousedown", mousedown);
    canvas.addEventListener("mousemove", mousemove);
    canvas.addEventListener("mouseup", mouseup);
    function mouseleave() { drag = null; }
    canvas.addEventListener("mouseleave", mouseleave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("touchstart", touchstart, { passive: true });
    canvas.addEventListener("touchmove", touchmove, { passive: false });
    canvas.addEventListener("touchend", touchend, { passive: true });

    return () => {
      canvas.removeEventListener("mousedown", mousedown);
      canvas.removeEventListener("mousemove", mousemove);
      canvas.removeEventListener("mouseup", mouseup);
      canvas.removeEventListener("mouseleave", mouseleave);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("touchstart", touchstart);
      canvas.removeEventListener("touchmove", touchmove);
      canvas.removeEventListener("touchend", touchend);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0f0a05] overflow-hidden" style={{ zIndex: 1 }}>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 cursor-grab"
        style={{
          filter: parchment ? "sepia(.4) contrast(1.05) brightness(.95)" : "none",
          transition: "filter .8s ease",
          touchAction: "none",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none z-[4]" style={{
        background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,.45) 75%, rgba(0,0,0,.75) 100%)",
        mixBlendMode: "multiply",
      }} />

      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none z-[5]" style={{
        opacity: 0.15,
        mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
      }} />

      {/* Title */}
      <header className="fixed top-0 left-0 right-0 z-10 pointer-events-none flex justify-center p-2.5">
        <div
          className="pointer-events-auto"
          style={{
            fontFamily: "Cinzel, serif",
            fontWeight: 900,
            letterSpacing: ".12em",
            fontSize: "clamp(14px, 2.2vw, 24px)",
            color: "#f5e6c4",
            textShadow: "0 2px 0 #000, 0 0 12px rgba(0,0,0,.8), 0 0 2px #5a3a15",
            padding: "8px 18px",
            background: "linear-gradient(180deg, rgba(60,35,12,.85), rgba(25,15,5,.85))",
            border: "2px solid #a07b48",
            borderImage: "linear-gradient(#e9d19c,#8a6233) 1",
            boxShadow: "0 4px 18px rgba(0,0,0,.6), inset 0 0 30px rgba(0,0,0,.4)",
            whiteSpace: "nowrap",
            backdropFilter: "blur(2px)",
          }}
        >
          <span style={{ opacity: 0.8, marginRight: 8, color: "#d4a76a" }}>✦</span>
          ATLAS ANTIQUA
          <span style={{ opacity: 0.8, marginLeft: 8, color: "#d4a76a" }}>✦</span>
        </div>
      </header>

      {/* Parchment toggle */}
      <div className="fixed top-[70px] left-3.5 z-10">
        <BrassBtn active={parchment} onClick={() => setParchment(!parchment)}>
          Parchment / Real
        </BrassBtn>
      </div>

      {/* Controls */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-2 px-2 py-1.5" style={{
        background: "rgba(20,14,8,0.5)",
        borderRadius: 8,
        border: "1px solid rgba(141,110,60,0.4)",
        backdropFilter: "blur(4px)",
      }}>
        <BrassBtn onClick={() => { rs.current.zoom = Math.min(rs.current.zoom * 1.35, 40); scheduleRender(); }}>
          ＋ Zoom In
        </BrassBtn>
        <BrassBtn onClick={() => { rs.current.zoom = Math.max(rs.current.zoom / 1.35, 0.3); scheduleRender(); }}>
          － Zoom Out
        </BrassBtn>
        <BrassBtn onClick={() => {
          rs.current.centerLon = 10;
          rs.current.centerLat = 10;
          rs.current.zoom = 1;
          scheduleRender();
        }}>
          ⌖ Reset
        </BrassBtn>
      </div>

      {/* Panel */}
      <MuseumPanel
        site={selectedSite}
        onClose={() => setSelectedSite(null)}
        onExplore={() => {
          if (selectedSite) setExploringSite(selectedSite);
        }}
        onPanorama360={() => {
          if (selectedSite) setPanorama360(selectedSite);
        }}
      />

      {exploringSite && (
        <SiteViewer3D
          siteId={exploringSite.id}
          siteName={exploringSite.name}
          onClose={() => setExploringSite(null)}
        />
      )}

      {panorama360 && (
        <PanoramaViewer
          imageUrl={PANORAMA_URL[panorama360.id] ?? PANORAMA_URL.default}
          hotspots={(PANORAMA_HOTSPOTS[panorama360.id] ?? PANORAMA_HOTSPOTS.default).map((h) => ({
            ...h,
            description: h.description ?? `${h.label} viewpoint`,
          }))}
          siteName={panorama360.name}
          onClose={() => setPanorama360(null)}
        />
      )}
    </div>
  );
}

// ─── Drawing helpers ─────────────────────────────────────────────────

function drawContinent(
  ctx: CanvasRenderingContext2D,
  outline: ContinentOutline,
  state: RenderState,
  noise: Map<string, [number, number][]>,
  parchment: boolean,
) {
  const pts = outline.points;
  const offsets = noise.get(outline.name) ?? [];

  const color1 = parchment ? "#4a3820" : "#3a4a5a";
  const color2 = parchment ? "#5c4428" : "#4a6070";
  const color3 = parchment ? "#6b4f30" : "#5a7080";
  const fill = parchment ? "#d4c4a0" : "#b8c8d0";

  const passes = [
    { omul: -0.8, lw: 1.2, clr: color1, a: 0.35 },
    { omul: 0, lw: 1.6, clr: color2, a: 0.55 },
    { omul: 0.6, lw: 1.0, clr: color3, a: 0.25 },
  ];

  for (const pass of passes) {
    ctx.beginPath();
    ctx.strokeStyle = pass.clr;
    ctx.lineWidth = pass.lw;
    ctx.globalAlpha = pass.a;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < pts.length; i++) {
      const dx = offsets[i]?.[0] ?? 0;
      const dy = offsets[i]?.[1] ?? 0;
      const p = project(pts[i][0] + dx * pass.omul, pts[i][1] + dy * pass.omul, state);
      if (!p) continue;
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Flat fill
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.08;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(90,74,48,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(20,14,8,0.4)";
  ctx.fill();

  // Tick marks every 45°
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    const inner = a % 90 === 0 ? size - 4 : size - 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rad) * inner, Math.sin(rad) * inner);
    ctx.lineTo(Math.cos(rad) * size, Math.sin(rad) * size);
    ctx.strokeStyle = "rgba(90,74,48,0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // N arm — gold, prominent
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -size - 2);
  ctx.strokeStyle = "#d4a257";
  ctx.lineWidth = 2;
  ctx.stroke();
  // N arrowhead
  ctx.beginPath();
  ctx.moveTo(0, -size - 8);
  ctx.lineTo(-5, -size - 2);
  ctx.lineTo(5, -size - 2);
  ctx.closePath();
  ctx.fillStyle = "#d4a257";
  ctx.fill();

  // S, E, W arms — subtler
  const minorArms = [
    { angle: Math.PI, len: size },
    { angle: Math.PI / 2, len: size - 2 },
    { angle: -Math.PI / 2, len: size - 2 },
  ];
  for (const arm of minorArms) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(arm.angle) * arm.len, Math.sin(arm.angle) * arm.len);
    ctx.strokeStyle = "rgba(90,74,48,0.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Labels
  ctx.font = "bold 10px Cinzel, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d4a257";
  ctx.fillText("N", 0, -size - 14);
  ctx.fillStyle = "rgba(90,74,48,0.8)";
  ctx.fillText("S", 0, size + 12);
  ctx.fillText("E", size + 10, 0);
  ctx.fillText("W", -size - 10, 0);

  ctx.restore();
}

function drawMarker(ctx: CanvasRenderingContext2D, site: AtlasSite, state: RenderState, active: boolean) {
  const p = project(site.lon, site.lat, state);
  if (!p) return;
  const [mx, my] = p;

  if (mx < -20 || mx > state.w + 20 || my < -20 || my > state.h + 20) return;

  ctx.save();

  // Obelisk body
  const obW = 8;
  const obH = 28;
  const tipH = 8;
  const baseW = 12;
  const baseH = 4;
  const obX = mx - obW / 2;
  const obY = my - obH - tipH - baseH;

  ctx.beginPath();
  ctx.moveTo(obX + obW / 2, obY);                                          // tip
  ctx.lineTo(obX + obW * 0.7, obY + tipH);                                // tip right
  ctx.lineTo(obX + obW * 0.65, obY + tipH + 2);                           // neck right
  ctx.lineTo(obX + obW, obY + obH + tipH);                                 // body right
  ctx.lineTo(obX + baseW - (baseW - obW) / 2, obY + obH + tipH);          // base right top
  ctx.lineTo(obX + baseW - (baseW - obW) / 2, obY + obH + tipH + baseH);  // base right bottom
  ctx.lineTo(obX - (baseW - obW) / 2, obY + obH + tipH + baseH);          // base left bottom
  ctx.lineTo(obX - (baseW - obW) / 2, obY + obH + tipH);                  // base left top
  ctx.lineTo(obX, obY + obH + tipH);                                       // body left
  ctx.lineTo(obX + obW * 0.35, obY + tipH + 2);                           // neck left
  ctx.lineTo(obX + obW * 0.3, obY + tipH);                                 // tip left
  ctx.closePath();

  const grad = ctx.createLinearGradient(obX, obY, obX + obW, obY + obH + tipH + baseH);
  grad.addColorStop(0, "#e8c78a");
  grad.addColorStop(0.35, "#b68d4a");
  grad.addColorStop(0.7, "#7a5a2e");
  grad.addColorStop(1, "#4a351a");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = active ? "#ffdb7e" : "#2b1708";
  ctx.lineWidth = active ? 1.5 : 0.8;
  ctx.stroke();

  // Glow star on tip
  ctx.beginPath();
  ctx.arc(obX + obW / 2, obY - 1, active ? 5 : 3, 0, Math.PI * 2);
  ctx.fillStyle = active ? "#ffdb7e" : "#ffefc2";
  ctx.globalAlpha = active ? 1 : 0.7;
  ctx.fill();

  if (active) {
    ctx.beginPath();
    ctx.arc(obX + obW / 2, obY - 1, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#ffdb7e";
    ctx.globalAlpha = 0.2;
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // Label
  if (state.zoom > 1.5) {
    ctx.font = "700 11px Cinzel, serif";
    ctx.fillStyle = "#f5e6c4";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.strokeText(site.name, mx, obY - 6);
    ctx.fillText(site.name, mx, obY - 6);
  }

  ctx.restore();
}

// ─── Sub-components ──────────────────────────────────────────────────

function BrassBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer ${active ? "active" : ""}`}
      style={{
        fontFamily: "Cinzel, serif",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: ".04em",
        color: "#2a1a0a",
        background: active
          ? "linear-gradient(180deg,#fff1cf 0%,#e9c98c 100%)"
          : "linear-gradient(180deg,#f7e8c3 0%,#e7d1a3 45%,#d2b481 100%)",
        border: "2px solid #7a552e",
        borderRadius: 4,
        padding: "10px 14px",
        textAlign: "left",
        boxShadow: active
          ? "0 0 0 2px #d4a257 inset, 0 3px 0 #5a3f20, 0 0 14px rgba(212,162,87,.5)"
          : "0 3px 0 #5a3f20, 0 4px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.4)",
        transition: "all .15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {active && <span style={{ marginLeft: 8, fontWeight: 900 }}>✓</span>}
    </button>
  );
}

function MuseumPanel({
  site,
  onClose,
  onExplore,
  onPanorama360,
}: {
  site: AtlasSite | null;
  onClose: () => void;
  onExplore: () => void;
  onPanorama360?: () => void;
}) {
  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: site ? 0 : "-440px",
        width: "min(380px, 92vw)",
        height: "100%",
        zIndex: 20,
        transition: "right .5s cubic-bezier(.22,1,.36,1)",
        pointerEvents: site ? "auto" : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "8px",
          background: "linear-gradient(180deg, #fdf6e0 0%, #f0dfb8 40%, #e3cfa1 100%)",
          boxShadow: "-12px 0 40px rgba(0,0,0,.6)",
          border: "1px solid #a58a62",
          borderLeft: "none",
          overflowY: "auto",
          padding: 0,
          color: "#24180e",
        }}
      >
        {site ? (
          <>
            <div
              style={{
                position: "sticky",
                top: 0,
                background: "linear-gradient(180deg,#f7e8c3,#e4cb97)",
                padding: "16px 18px",
                borderBottom: "2px solid #8b683e",
                zIndex: 2,
              }}
            >
              <button
                onClick={onClose}
                className="cursor-pointer"
                style={{
                  position: "absolute",
                  right: 10,
                  top: 10,
                  width: 28,
                  height: 28,
                  border: "1px solid #7a552e",
                  background: "#e7d1a3",
                  borderRadius: 2,
                  fontWeight: 900,
                  fontSize: 16,
                  lineHeight: 1,
                  color: "#3a2410",
                }}
              >
                ×
              </button>
              <h2
                style={{
                  fontFamily: "Cinzel",
                  fontWeight: 800,
                  fontSize: 22,
                  color: "#2a1605",
                  margin: "0 28px 4px 0",
                  lineHeight: 1.15,
                }}
              >
                {site.name}
              </h2>
              <div style={{ fontSize: 13, opacity: 0.8, fontStyle: "italic" }}>
                {`${site.country} • ${site.era}`}
              </div>
            </div>
            <div style={{ padding: "18px 20px 28px", fontSize: 16, lineHeight: 1.55, color: "#2d1c0c" }}>
              <p>{site.desc}</p>
              <h4 style={{ fontFamily: "Cinzel", margin: "18px 0 6px", fontSize: 14, letterSpacing: ".06em", color: "#5a3a18" }}>
                Key Artifacts
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
                {site.artifacts.map((a, i) => (
                  <li key={i} style={{
                    padding: "6px 0 6px 18px", position: "relative",
                    borderBottom: "1px dashed rgba(122,85,46,.25)", fontSize: 15,
                  }}>
                    <span style={{ position: "absolute", left: 0, color: "#8b5e2a", fontSize: 10, top: 8 }}>
                      ◆
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
              {site.nigerian && (
                <>
                  <div style={{
                    display: "inline-block", marginTop: 10, padding: "6px 10px",
                    background: "#2a1605", color: "#f5e6c4", borderRadius: 3,
                    fontSize: 12, letterSpacing: ".04em", border: "1px solid #d4a76a",
                  }}>
                    Zamani Project: 3D scan available
                  </div>
                  <p style={{ marginTop: 10, fontSize: 14, opacity: 0.85 }}>
                    {site.zamani}
                  </p>
                  {site.id === "benin" && (
                    <p style={{ marginTop: 12 }}><em>Tip: Enable "Historical 1897" to overlay the British officer's map.</em></p>
                  )}
                  {site.id === "sukur" && (
                    <p style={{ marginTop: 12 }}><em>Tip: Load Zamani LiDAR to view point cloud.</em></p>
                  )}
                </>
              )}

              {/* Explore in 3D */}
              <button
                onClick={onExplore}
                className="cursor-pointer"
                style={{
                  width: "100%", marginTop: 14,
                  fontFamily: "Cinzel, serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: ".04em",
                  color: "#f5e6c4",
                  background: "linear-gradient(180deg,#4a3218,#2a1605)",
                  border: "1px solid #d4a76a",
                  borderRadius: 4,
                  padding: "10px 14px",
                  boxShadow: "0 3px 0 #1a0d04",
                  transition: "all .15s ease",
                }}
              >
                ⛏ Explore in 3D
              </button>

              {/* 360° Panorama */}
              {onPanorama360 && (
                <button
                  onClick={onPanorama360}
                  className="cursor-pointer"
                  style={{
                    width: "100%", marginTop: 8,
                    fontFamily: "Cinzel, serif",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: ".04em",
                    color: "#f5e6c4",
                    background: "linear-gradient(180deg,#3a2a18,#1a0d04)",
                    border: "1px solid #d4a76a",
                    borderRadius: 4,
                    padding: "10px 14px",
                    boxShadow: "0 3px 0 #1a0d04",
                    transition: "all .15s ease",
                  }}
                >
                  ◉ 360° View
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", marginTop: "40%", color: "#6b4e2e", fontSize: 15, padding: "0 20px" }}>
            Drag the map to explore. Click an obelisk marker to discover ancient sites.
          </div>
        )}
      </div>
    </aside>
  );
}
