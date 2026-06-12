"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { ThreeDMapScene } from "@encarta/core";

interface ThreeDMapViewerProps {
  scene: ThreeDMapScene;
  height?: string;
}

const ZOOM_SCALE: Record<number, number> = {
  6: 50000,
  7: 30000,
  8: 20000,
  9: 12000,
  10: 8000,
  11: 5000,
  12: 3000,
  13: 2000,
  14: 1000,
  15: 600,
  16: 300,
};

function latLngToPos(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  scale: number
): [number, number, number] {
  const x = (lng - centerLng) * Math.cos((centerLat * Math.PI) / 180) * scale;
  const z = (centerLat - lat) * scale;
  return [x, 0, z];
}

function Terrain({ scene }: { scene: ThreeDMapScene }) {
  const scale = ZOOM_SCALE[scene.zoom] || ZOOM_SCALE[14];
  const halfExtent = scale * 0.15;
  const color = scene.terrain.color || "#8a9a6a";

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[halfExtent * 2, halfExtent * 2]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Buildings({ scene }: { scene: ThreeDMapScene }) {
  const scale = ZOOM_SCALE[scene.zoom] || ZOOM_SCALE[14];

  if (!scene.buildings || scene.buildings.length === 0) return null;

  return (
    <group>
      {scene.buildings.map((b) => {
        const [x, y, z] = latLngToPos(b.lat, b.lng, scene.centerLat, scene.centerLng, scale);
        return (
          <mesh key={b.id} position={[x, b.height / 2, z]} castShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshStandardMaterial color={b.color} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

function Annotations({ scene }: { scene: ThreeDMapScene }) {
  const scale = ZOOM_SCALE[scene.zoom] || ZOOM_SCALE[14];

  if (!scene.annotations || scene.annotations.length === 0) return null;

  return (
    <group>
      {scene.annotations.map((a) => {
        const [x, y, z] = latLngToPos(a.lat, a.lng, scene.centerLat, scene.centerLng, scale);
        return (
          <Html key={a.label} position={[x, 5, z]} center distanceFactor={30}>
            <div
              className="px-2 py-1 bg-white border-2 border-black text-xs font-bold whitespace-nowrap shadow-md pointer-events-auto"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px" }}
              title={a.description}
            >
              {a.articleSlug ? (
                <a
                  href={`/article/${a.articleSlug}`}
                  className="hover:text-[var(--orange)]"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {a.label} ⓘ
                </a>
              ) : (
                a.label
              )}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

export default function ThreeDMapViewer({ scene, height = "400px" }: ThreeDMapViewerProps) {
  const zoom = scene.zoom || 14;
  const scale = ZOOM_SCALE[zoom] || ZOOM_SCALE[14];
  const distance = Math.max(50, scale * 0.15);

  return (
    <div style={{ height, width: "100%" }} className="rounded-xl border-2 border-black overflow-hidden bg-[#e8e0d0]">
      <Canvas
        camera={{ position: [distance * 0.5, distance * 0.4, distance], fov: 50 }}
        shadows={{ enabled: true, type: 1 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[50, 100, 50]} intensity={0.8} castShadow />
        <directionalLight position={[-30, 50, -30]} intensity={0.3} />
        <hemisphereLight args={["#87ceeb", "#8a9a6a", 0.3]} />
        <Terrain scene={scene} />
        <Buildings scene={scene} />
        <Annotations scene={scene} />
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={10}
          maxDistance={distance * 3}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
    </div>
  );
}
