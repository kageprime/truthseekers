"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";

interface Hotspot {
  id: string;
  position: [number, number, number];
  label: string;
  description?: string;
}

interface Props {
  imageUrl: string;
  hotspots?: Hotspot[];
  siteName: string;
  onClose: () => void;
}

function HotspotMarker({ position, label, description, isHovered, onHover }: {
  position: [number, number, number];
  label: string;
  description?: string;
  isHovered: boolean;
  onHover: (v: boolean) => void;
}) {
  const meshRef = useState<THREE.Mesh | null>(null)[1];
  const [pulse, setPulse] = useState(0);

  useFrame((_, delta) => setPulse((p) => p + delta * 2));

  const scale = isHovered ? 1.5 : 1 + Math.sin(pulse) * 0.1;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        scale={[scale, scale, scale]}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshStandardMaterial
          color="#d4a257"
          emissive="#d4a257"
          emissiveIntensity={isHovered ? 1.0 : 0.4}
          transparent
          opacity={0.85}
        />
      </mesh>
      {isHovered && (
        <Html center distanceFactor={80}>
          <div
            style={{
              background: "rgba(20,14,8,0.92)",
              border: "1px solid #d4a257",
              borderRadius: 4,
              padding: "8px 14px",
              color: "#f5e6c4",
              maxWidth: 220,
              fontFamily: "'IM Fell English', serif",
              lineHeight: 1.4,
              pointerEvents: "none",
            }}
          >
            <strong style={{ fontFamily: "Cinzel, serif", fontSize: 13 }}>{label}</strong>
            {description && <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>{description}</p>}
          </div>
        </Html>
      )}
    </group>
  );
}

function PanoramaScene({ imageUrl, hotspots = [] }: { imageUrl: string; hotspots: Hotspot[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const texture = useTexture(imageUrl);

  useEffect(() => {
    if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  return (
    <group>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 60, 40]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      {hotspots.map((h) => (
        <HotspotMarker
          key={h.id}
          position={h.position}
          label={h.label}
          description={h.description}
          isHovered={hovered === h.id}
          onHover={(v) => setHovered(v ? h.id : null)}
        />
      ))}
    </group>
  );
}

function FallbackScene({ hotspots = [] }: { hotspots: Hotspot[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#6a9ec0");
    g.addColorStop(0.45, "#b8d4e3");
    g.addColorStop(0.52, "#d4b896");
    g.addColorStop(1, "#8a7a58");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#c4a265";
    ctx.globalAlpha = 0.3;
    ctx.fillRect(300, 220, 120, 60);
    ctx.fillRect(550, 200, 90, 80);
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <group>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 60, 40]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      {hotspots.map((h) => (
        <HotspotMarker
          key={h.id}
          position={h.position}
          label={h.label}
          description={h.description}
          isHovered={hovered === h.id}
          onHover={(v) => setHovered(v ? h.id : null)}
        />
      ))}
    </group>
  );
}

function LoadingSpinner() {
  return (
    <Html center>
      <div style={{
        width: 40, height: 40,
        border: "3px solid rgba(212,162,87,0.3)",
        borderTopColor: "#d4a257",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Html>
  );
}

export default function PanoramaViewer({ imageUrl, hotspots = [], siteName, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas camera={{ fov: 75, near: 0.1, far: 1000 }}>
        <Suspense fallback={<LoadingSpinner />}>
          <PanoramaScene imageUrl={imageUrl} hotspots={hotspots} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate
          rotateSpeed={0.5}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
      </Canvas>

      {/* HUD — site name */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div
          className="px-4 py-1.5 rounded text-sm tracking-wider"
          style={{
            fontFamily: "Cinzel, serif",
            background: "rgba(10,8,5,0.6)",
            border: "1px solid rgba(212,162,87,0.5)",
            color: "#f5e6c4",
            backdropFilter: "blur(4px)",
          }}
        >
          {siteName} — 360° View
        </div>
      </div>

      {/* HUD — instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div
          className="px-3 py-1.5 rounded text-xs"
          style={{
            background: "rgba(10,8,5,0.6)",
            color: "rgba(245,230,196,0.7)",
            backdropFilter: "blur(4px)",
          }}
        >
          Drag to look around · Hover hotspots for details
        </div>
      </div>

      {/* Exit */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded cursor-pointer"
        style={{
          background: "rgba(10,8,5,0.6)",
          border: "1px solid rgba(212,162,87,0.5)",
          color: "#f5e6c4",
          backdropFilter: "blur(4px)",
          fontSize: 16,
        }}
      >
        ✕
      </button>
    </div>
  );
}
