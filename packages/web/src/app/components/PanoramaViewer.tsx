"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Panorama3DBlockData, Tour3DBlockData, PanoramaHotspot, TourWaypoint } from "@encarta/core";
import { articleBus } from "@/lib/articleBus";
import { IconLightning } from "./Icons";

interface PanoramaViewerProps {
  data: Panorama3DBlockData | Tour3DBlockData;
  height?: string;
  isTour?: boolean;
}

// Spherical coordinates (pitch/yaw in degrees) to 3D Cartesian coords
function pitchYawToPos(pitch: number, yaw: number, radius = 450): [number, number, number] {
  const phi = (90 - pitch) * (Math.PI / 180);
  const theta = (yaw + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

// Generator for fallback canvas texture when external 360 image is loading or local
function createFallbackTexture(text: string, altText?: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.5, "#16213e");
    grad.addColorStop(1, "#0f3460");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 1024);

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    for (let x = 0; x < 2048; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y < 1024; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#f5efe0";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`360° Panorama: ${text}`, 1024, 480);
    if (altText) {
      ctx.font = "italic 32px sans-serif";
      ctx.fillStyle = "#c9a45f";
      ctx.fillText(altText, 1024, 550);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Inner 360 Sky Sphere component with texture crossfading
function SkySphere({
  src,
  altSrc,
  blend,
  title,
  primaryEra,
  secondaryEra,
}: {
  src: string;
  altSrc?: string;
  blend: number;
  title?: string;
  primaryEra?: string;
  secondaryEra?: string;
}) {
  const [texture1, setTexture1] = useState<THREE.Texture | null>(null);
  const [texture2, setTexture2] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();

    if (src && !src.startsWith("fallback:")) {
      loader.load(
        src,
        (tex) => { if (active) { tex.wrapS = THREE.RepeatWrapping; setTexture1(tex); } },
        undefined,
        () => { if (active) setTexture1(createFallbackTexture(title || "Scene", primaryEra)); }
      );
    } else {
      setTexture1(createFallbackTexture(title || "Primary Era", primaryEra));
    }

    if (altSrc) {
      if (!altSrc.startsWith("fallback:")) {
        loader.load(
          altSrc,
          (tex) => { if (active) { tex.wrapS = THREE.RepeatWrapping; setTexture2(tex); } },
          undefined,
          () => { if (active) setTexture2(createFallbackTexture(title || "Alternate Era", secondaryEra)); }
        );
      } else {
        setTexture2(createFallbackTexture(title || "Secondary Era", secondaryEra));
      }
    }
    return () => { active = false; };
  }, [src, altSrc, title, primaryEra, secondaryEra]);

  return (
    <group>
      {/* Primary Sky Sphere */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 60, 40]} />
        <meshBasicMaterial map={texture1} side={THREE.BackSide} transparent opacity={1 - blend * 0.95} />
      </mesh>

      {/* Secondary Sky Sphere (Alternate Era/Reality) */}
      {altSrc && (
        <mesh scale={[-1, 1, 1]}>
          <sphereGeometry args={[498, 60, 40]} />
          <meshBasicMaterial map={texture2} side={THREE.BackSide} transparent opacity={blend} />
        </mesh>
      )}
    </group>
  );
}

// 3D Pin Hotspots positioned on sphere surface
function Hotspots({ hotspots }: { hotspots?: PanoramaHotspot[] }) {
  if (!hotspots || hotspots.length === 0) return null;

  return (
    <group>
      {hotspots.map((h) => {
        const [x, y, z] = pitchYawToPos(h.pitch, h.yaw, 440);
        return (
          <Html key={h.id} position={[x, y, z]} center distanceFactor={250}>
            <button
              onClick={() => {
                articleBus.emit({
                  type: "CLAIM_CLICKED",
                  payload: { claimId: h.claimId || h.id, text: h.label },
                });
              }}
              className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-lg transition-transform duration-200 hover:scale-110 cursor-pointer pointer-events-auto"
              style={{
                background: "var(--surface-elevated, #fff)",
                borderColor: "var(--gold, #a67c2f)",
                color: "var(--ink, #1a1612)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">{h.label}</span>
              {h.description && (
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 p-2 rounded bg-surface border border-border text-[10px] text-muted max-w-[180px] text-center shadow-xl">
                  {h.description}
                </div>
              )}
            </button>
          </Html>
        );
      })}
    </group>
  );
}

// Camera controller for smooth tour waypoint transitions
function TourController({
  activeWaypoint,
  onReached,
}: {
  activeWaypoint: TourWaypoint | null;
  onReached?: (wp: TourWaypoint) => void;
}) {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (activeWaypoint) {
      const [x, y, z] = pitchYawToPos(activeWaypoint.pitch, activeWaypoint.yaw, 10);
      targetPos.current = new THREE.Vector3(-x, -y, -z);
      onReached?.(activeWaypoint);
    }
  }, [activeWaypoint, onReached]);

  useFrame(() => {
    if (targetPos.current) {
      camera.lookAt(targetPos.current);
    }
  });

  return null;
}

export default function PanoramaViewer({ data, height = "450px", isTour = false }: PanoramaViewerProps) {
  const [blend, setBlend] = useState(0);
  const [activeWpIndex, setActiveWpIndex] = useState<number>(0);
  const [isPlayingTour, setIsPlayingTour] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const waypoints = (data as Tour3DBlockData).waypoints ?? [];
  const activeWaypoint = isTour && waypoints.length > 0 ? waypoints[activeWpIndex] : null;

  const primaryEra = (data as Panorama3DBlockData).primaryEra || "Present Day";
  const secondaryEra = (data as Panorama3DBlockData).secondaryEra || "Historical Era";

  // Auto-play tour progression timer
  useEffect(() => {
    if (!isPlayingTour || waypoints.length === 0) return;
    const timer = setInterval(() => {
      setActiveWpIndex((idx) => {
        const next = (idx + 1) % waypoints.length;
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [isPlayingTour, waypoints.length]);

  // Emit waypoint updates to floating chat widget
  const handleWaypointReached = (wp: TourWaypoint) => {
    articleBus.emit({
      type: "TOUR_WAYPOINT_REACHED",
      payload: {
        title: wp.title,
        narration: wp.narration,
        claimId: wp.claimId,
      },
    });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative my-4 rounded-xl border border-border overflow-hidden bg-black select-none"
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* R3F Canvas */}
      <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }}>
        <SkySphere
          src={data.src}
          altSrc={(data as Panorama3DBlockData).altSrc}
          blend={blend}
          title={data.title}
          primaryEra={primaryEra}
          secondaryEra={secondaryEra}
        />
        <Hotspots hotspots={data.hotspots} />
        <TourController activeWaypoint={activeWaypoint} onReached={handleWaypointReached} />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          rotateSpeed={-0.4}
          zoomSpeed={0.8}
          minDistance={0.01}
          maxDistance={2}
        />
      </Canvas>

      {/* Header Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-medium flex items-center gap-2 pointer-events-auto">
          <IconLightning size={14} className="text-gold" />
          <span>{data.title || (isTour ? "360° Virtual Tour" : "360° Panorama")}</span>
        </div>

        <button
          onClick={toggleFullscreen}
          className="px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs hover:bg-black/80 transition-colors pointer-events-auto cursor-pointer"
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? "Exit ⛶" : "Fullscreen ⛶"}
        </button>
      </div>

      {/* Dual Era / Reality Slider Overlay */}
      {(data as Panorama3DBlockData).altSrc && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-10 p-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-white flex flex-col gap-1.5 pointer-events-auto sm:w-72">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gold">
            <span>{primaryEra}</span>
            <span>{secondaryEra}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={blend}
            onChange={(e) => setBlend(parseFloat(e.target.value))}
            className="w-full accent-gold cursor-pointer"
          />
          <div className="text-[10px] text-white/70 text-center">
            Drag to blend between realities / historical eras
          </div>
        </div>
      )}

      {/* Guided Tour Controls */}
      {isTour && waypoints.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 max-w-sm p-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white pointer-events-auto space-y-2">
          {activeWaypoint && (
            <div>
              <div className="text-xs font-bold text-gold flex items-center gap-2">
                <span>Stop {activeWpIndex + 1}/{waypoints.length}:</span>
                <span>{activeWaypoint.title}</span>
              </div>
              <p className="text-[11px] text-white/80 line-clamp-2 mt-0.5">{activeWaypoint.narration}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveWpIndex((idx) => (idx - 1 + waypoints.length) % waypoints.length)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs cursor-pointer"
            >
              ◀ Prev
            </button>
            <button
              onClick={() => setIsPlayingTour(!isPlayingTour)}
              className="px-3 py-1 rounded bg-gold text-black font-bold text-xs cursor-pointer"
            >
              {isPlayingTour ? "Pause ❚❚" : "Play ▶"}
            </button>
            <button
              onClick={() => setActiveWpIndex((idx) => (idx + 1) % waypoints.length)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs cursor-pointer"
            >
              Next ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
