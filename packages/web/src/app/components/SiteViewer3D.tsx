"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, Sky, Html } from "@react-three/drei";
import * as THREE from "three";

// ─── Types ───────────────────────────────────────────────────────────

interface SiteSceneProps {
  siteId: string;
}

// ─── Main component ──────────────────────────────────────────────────

interface Props {
  siteId: string;
  siteName: string;
  onClose: () => void;
}

const CAM_POS: Record<string, [number, number, number]> = {
  giza: [0, 5, 300],
  zimbabwe: [0, 5, 160],
  lalibela: [0, 15, 90],
  axum: [0, 5, 100],
};

export default function SiteViewer3D({ siteId, siteName, onClose }: Props) {
  const [locked, setLocked] = useState(false);
  const camPos = CAM_POS[siteId] ?? [0, 5, 300];

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas camera={{ fov: 75, near: 0.1, far: 2000, position: camPos }}>
        <color attach="background" args={["#87ceeb"]} />
        <fog attach="fog" args={["#87ceeb", 600, 1500]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[100, 200, 100]} intensity={1.0} />
        <directionalLight position={[-50, 100, -50]} intensity={0.3} />
        <hemisphereLight args={["#87ceeb", "#d4b896", 0.4]} />

        <Sky sunPosition={[200, 100, 200]} turbidity={8} rayleigh={2} />

        <SiteScene siteId={siteId} />

        <FPCamera onLockChange={setLocked} />
      </Canvas>

      {/* HUD */}
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
          {siteName}
        </div>
      </div>

      {/* Crosshair */}
      {locked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div
            style={{
              width: 20,
              height: 20,
              position: "relative",
              opacity: 0.6,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 1,
                background: "#f5e6c4",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: 1,
                background: "#f5e6c4",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 4,
                height: 4,
                borderRadius: "50%",
                border: "1px solid #d4a257",
              }}
            />
          </div>
        </div>
      )}

      {/* Pause/exit overlay */}
      {!locked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="px-8 py-6 rounded text-center"
            style={{
              background: "linear-gradient(180deg, rgba(247,232,195,.95), rgba(210,180,129,.92))",
              border: "2px solid #7a552e",
              maxWidth: 320,
            }}
          >
            <h2
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: 18,
                color: "#2a1605",
                margin: "0 0 6px",
              }}
            >
              Paused
            </h2>
            <p style={{ fontSize: 14, color: "#3a2410", margin: "0 0 16px", lineHeight: 1.4 }}>
              Click the scene to resume exploring.
            </p>
            <button
              onClick={onClose}
              className="cursor-pointer"
              style={{
                fontFamily: "Cinzel, serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: ".04em",
                color: "#f5e6c4",
                background: "linear-gradient(180deg,#4a3218,#2a1605)",
                border: "1px solid #d4a76a",
                borderRadius: 4,
                padding: "10px 24px",
                boxShadow: "0 3px 0 #1a0d04",
              }}
            >
              Return to Map
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── First-person camera with WASD ───────────────────────────────────

function FPCamera({ onLockChange }: { onLockChange: (l: boolean) => void }) {
  const controls = useRef<any>(null);
  const keys = useRef<Set<string>>(new Set());
  const { camera } = useThree();
  const speed = 40;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD" || e.code === "Space" || e.code === "ShiftLeft") {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    const speedMs = speed * delta;
    if (keys.current.has("KeyW")) camera.position.add(forward.clone().multiplyScalar(speedMs));
    if (keys.current.has("KeyS")) camera.position.add(forward.clone().multiplyScalar(-speedMs));
    if (keys.current.has("KeyA")) camera.position.add(right.clone().multiplyScalar(-speedMs));
    if (keys.current.has("KeyD")) camera.position.add(right.clone().multiplyScalar(speedMs));

    // Clamp y to ground
    if (camera.position.y < 2) camera.position.y = 2;
  });

  return (
    <PointerLockControls
      ref={controls}
      onLock={() => onLockChange(true)}
      onUnlock={() => onLockChange(false)}
    />
  );
}

// ─── Site scene ──────────────────────────────────────────────────────

function SiteScene({ siteId }: SiteSceneProps) {
  switch (siteId) {
    case "giza":
      return <GizaScene />;
    case "zimbabwe":
      return <ZimbabweScene />;
    case "lalibela":
      return <LalibelaScene />;
    case "axum":
      return <AxumScene />;
    default:
      return <GizaScene />;
  }
}

// ─── Giza Scene ──────────────────────────────────────────────────────

const PYR_COLOR = "#c4a265";
const PYR_COLOR_DARK = "#a88545";
const SAND_COLOR = "#d4b896";
const STONE_COLOR = "#b8a088";
const INFO_COLOR = "#d4a257";

function GizaScene() {
  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color={SAND_COLOR} roughness={0.9} />
      </mesh>

      {/* Great Pyramid of Khufu */}
      <group position={[0, 0, 0]}>
        <Pyramid base={230} height={146} color={PYR_COLOR} />
        <PyramidInterior />
      </group>

      {/* Pyramid of Khafre */}
      <group position={[280, 0, -180]}>
        <Pyramid base={215} height={136} color={PYR_COLOR_DARK} />
      </group>

      {/* Pyramid of Menkaure */}
      <group position={[480, 0, -320]}>
        <Pyramid base={105} height={65} color={PYR_COLOR_DARK} />
      </group>

      {/* Great Sphinx */}
      <Sphinx position={[-140, 0, 120]} />

      {/* Info points */}
      <InfoPoint position={[0, 2, -118]} label="Entrance to the Great Pyramid" />
      <InfoPoint position={[0, 85, 0]} label="King's Chamber — Granite sarcophagus chamber at the heart of Khufu's pyramid" />
      <InfoPoint position={[280, 65, -180]} label="Pyramid of Khafre — Appears taller due to its elevated foundation" />
      <InfoPoint position={[480, 35, -320]} label="Pyramid of Menkaure — The smallest of the three Giza pyramids" />
      <InfoPoint position={[-140, 6, 120]} label="Great Sphinx — 73m long, 20m high. Oldest known monumental sculpture" />
    </group>
  );
}

// ─── Pyramid (hollow, 4 faces + base) ──────────────────────────────

function Pyramid({ base, height, color }: { base: number; height: number; color: string }) {
  const hb = base / 2;

  const northFace = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-hb, 0);
    s.lineTo(hb, 0);
    s.lineTo(0, height);
    s.closePath();
    // Entrance passage hole (only for Khufu — we always create it, it's small enough)
    if (base === 230) {
      const h = new THREE.Path();
      h.moveTo(-0.8, 16);
      h.lineTo(0.8, 16);
      h.lineTo(0.8, 19);
      h.lineTo(-0.8, 19);
      h.closePath();
      s.holes.push(h);
    }
    return s;
  }, [base, height]);

  const otherFace = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-hb, 0);
    s.lineTo(hb, 0);
    s.lineTo(0, height);
    s.closePath();
    return s;
  }, [base, height]);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.85 }),
    [color]
  );

  return (
    <group>
      {/* North face (faces -Z) */}
      <mesh position={[0, 0, -hb]} geometry={new THREE.ShapeGeometry(northFace)} material={material} />
      {/* South face (faces +Z) */}
      <mesh position={[0, 0, hb]} rotation={[0, Math.PI, 0]} geometry={new THREE.ShapeGeometry(otherFace)} material={material} />
      {/* East face (faces +X) */}
      <mesh position={[hb, 0, 0]} rotation={[0, Math.PI / 2, 0]} geometry={new THREE.ShapeGeometry(otherFace)} material={material} />
      {/* West face (faces -X) */}
      <mesh position={[-hb, 0, 0]} rotation={[0, -Math.PI / 2, 0]} geometry={new THREE.ShapeGeometry(otherFace)} material={material} />
      {/* Base floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[base - 2, base - 2]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── King's Chamber interior ───────────────────────────────────────

function PyramidInterior() {
  return (
    <group>
      {/* Passage from entrance to chamber — walls, floor, ceiling */}
      <Passage />
      {/* King's Chamber */}
      <KingsChamber />
    </group>
  );
}

function Passage() {
  const passageLength = 60;
  const passageWidth = 2;
  const passageHeight = 3;
  const hw = passageWidth / 2;

  // Floor
  return (
    <group position={[0, 0, -60]}>
      {/* Floor */}
      <mesh position={[0, 0.05, passageLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[passageWidth, passageLength]} />
        <meshStandardMaterial color="#6a5a40" roughness={0.9} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, passageHeight, passageLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[passageWidth, passageLength]} />
        <meshStandardMaterial color="#5a4a30" roughness={0.9} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-hw, passageHeight / 2, passageLength / 2]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.2, passageHeight, passageLength]} />
        <meshStandardMaterial color="#7a6a50" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Right wall */}
      <mesh position={[hw, passageHeight / 2, passageLength / 2]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.2, passageHeight, passageLength]} />
        <meshStandardMaterial color="#7a6a50" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function KingsChamber() {
  const cw = 10.5; // chamber width
  const cd = 5.2;  // chamber depth
  const ch = 5.8;  // chamber height

  return (
    <group position={[0, 48, 0]}>
      {/* Floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[cw, cd]} />
        <meshStandardMaterial color="#4a3a20" roughness={0.9} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, ch, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[cw, cd]} />
        <meshStandardMaterial color="#3a2a10" roughness={0.9} />
      </mesh>
      {/* Walls */}
      {[
        { pos: [0, ch / 2, -cd / 2], size: [cw, ch, 0.2] },
        { pos: [0, ch / 2, cd / 2], size: [cw, ch, 0.2] },
        { pos: [-cw / 2, ch / 2, 0], size: [0.2, ch, cd] },
        { pos: [cw / 2, ch / 2, 0], size: [0.2, ch, cd] },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos as any}>
          <boxGeometry args={wall.size as any} />
          <meshStandardMaterial color="#8a7a60" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Sarcophagus */}
      <group position={[0, 0.6, 0]}>
        {/* Outer box */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[2.2, 1, 1.5]} />
          <meshStandardMaterial color="#3a2a18" roughness={0.7} />
        </mesh>
        {/* Inner hollow (lid) */}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[2.4, 0.1, 1.7]} />
          <meshStandardMaterial color="#5a4a30" roughness={0.8} />
        </mesh>
      </group>

      {/* Info point inside chamber */}
      <InfoPoint position={[0, 2, 0]} label="Granite Sarcophagus — Red granite, 3.75 tons. The only object ever found in the King's Chamber." />
    </group>
  );
}

// ─── Great Sphinx ────────────────────────────────────────────────────

function Sphinx({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Body (recumbent lion) */}
      <mesh position={[0, 3, 0]} rotation={[0, Math.PI, 0]}>
        <boxGeometry args={[20, 7, 10]} />
        <meshStandardMaterial color={STONE_COLOR} roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 9, -1]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshStandardMaterial color={STONE_COLOR} roughness={0.9} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 6, -1]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color={STONE_COLOR} roughness={0.9} />
      </mesh>
      {/* Paws */}
      <mesh position={[-6, 1, 4]}>
        <boxGeometry args={[4, 1, 4]} />
        <meshStandardMaterial color={STONE_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[6, 1, 4]}>
        <boxGeometry args={[4, 1, 4]} />
        <meshStandardMaterial color={STONE_COLOR} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── Clickable info point ──────────────────────────────────────────

function InfoPoint({ position, label }: { position: [number, number, number]; label: string }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Mesh>(null);

  return (
    <group position={position}>
      {/* Glowing sphere */}
      <mesh
        ref={ref}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={() => setHovered(!hovered)}
      >
        <sphereGeometry args={[hovered ? 2 : 1.2, 16, 16]} />
        <meshStandardMaterial
          color={INFO_COLOR}
          emissive={INFO_COLOR}
          emissiveIntensity={hovered ? 0.8 : 0.3}
        />
      </mesh>

      {/* Floating label */}
      {hovered && (
        <Html distanceFactor={60} center>
          <div
            style={{
              background: "rgba(20,14,8,0.85)",
              border: "1px solid #d4a257",
              borderRadius: 4,
              padding: "6px 12px",
              color: "#f5e6c4",
              fontSize: 13,
              maxWidth: 240,
              fontFamily: "'IM Fell English', serif",
              lineHeight: 1.4,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

// ====================================================================
// Great Zimbabwe Scene
// ====================================================================

function ZimbabweScene() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color="#b8a070" roughness={0.95} />
      </mesh>

      {/* Great Enclosure — elliptical wall */}
      <GreatEnclosureWall />

      {/* Conical Tower */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 4.5, 0]}>
          <cylinderGeometry args={[2.2, 2.8, 9, 24]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.9} />
        </mesh>
        <InfoPoint position={[0, 7, 0]} label="Conical Tower — 9m tall, 5.5m diameter. Solid stone, a symbol of Zimbabwe's architectural mastery." />
      </group>

      {/* Outer wall section */}
      <CurvedWall cx={0} cz={0} radius={28} arcStart={0} arcEnd={Math.PI * 2} height={9} segments={20} />

      {/* Info points */}
      <InfoPoint position={[32, 5, 0]} label="Great Enclosure — 250m circumference, 11m high. Built without mortar, the largest ancient stone structure in sub-Saharan Africa." />
      <InfoPoint position={[-20, 4, 25]} label="Soapstone Zimbabwe Bird — National emblem, carved from soapstone, originally placed atop the Great Enclosure walls." />
    </group>
  );
}

function GreatEnclosureWall() {
  return (
    <CurvedWall cx={0} cz={0} radius={25} arcStart={0} arcEnd={Math.PI * 2} height={11} segments={24} />
  );
}

function CurvedWall({
  cx, cz, radius, arcStart, arcEnd, height, segments,
}: {
  cx: number; cz: number; radius: number;
  arcStart: number; arcEnd: number; height: number; segments: number;
}) {
  const meshes = [];
  for (let i = 0; i < segments; i++) {
    const t = arcStart + (arcEnd - arcStart) * (i / segments);
    const x = cx + Math.cos(t) * radius;
    const z = cz + Math.sin(t) * radius;
    const nextT = arcStart + (arcEnd - arcStart) * ((i + 1) / segments);
    const nextX = cx + Math.cos(nextT) * radius;
    const nextZ = cz + Math.sin(nextT) * radius;
    const mx = (x + nextX) / 2;
    const mz = (z + nextZ) / 2;
    const angle = Math.atan2(nextZ - z, nextX - x);
    const segmentWidth = Math.sqrt((nextX - x) ** 2 + (nextZ - z) ** 2);
    const wallHeight = height * (0.6 + 0.4 * (i / segments)); // slightly tapered
    meshes.push(
      <mesh key={i} position={[mx, wallHeight / 2, mz]} rotation={[0, -angle, 0]}>
        <boxGeometry args={[segmentWidth + 0.3, wallHeight, 1.8]} />
        <meshStandardMaterial color="#8a7a58" roughness={0.9} />
      </mesh>
    );
  }
  return <group>{meshes}</group>;
}

// ====================================================================
// Lalibela — Bete Giyorgis Scene
// ====================================================================

function LalibelaScene() {
  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#8a7a58" roughness={0.95} />
      </mesh>

      {/* Pit walls — the trench surrounding the church */}
      <PitWall />

      {/* Bete Giyorgis — cross-shaped church carved from rock */}
      <group position={[0, 0, 0]}>
        {/* Main body — central block of the cross */}
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[10, 10, 10]} />
          <meshStandardMaterial color="#6a5a40" roughness={0.85} />
        </mesh>
        {/* North arm */}
        <mesh position={[0, 5, -7]}>
          <boxGeometry args={[10, 10, 4]} />
          <meshStandardMaterial color="#6a5a40" roughness={0.85} />
        </mesh>
        {/* South arm */}
        <mesh position={[0, 5, 7]}>
          <boxGeometry args={[10, 10, 4]} />
          <meshStandardMaterial color="#6a5a40" roughness={0.85} />
        </mesh>
        {/* East arm */}
        <mesh position={[7, 5, 0]}>
          <boxGeometry args={[4, 10, 10]} />
          <meshStandardMaterial color="#6a5a40" roughness={0.85} />
        </mesh>
        {/* West arm */}
        <mesh position={[-7, 5, 0]}>
          <boxGeometry args={[4, 10, 10]} />
          <meshStandardMaterial color="#6a5a40" roughness={0.85} />
        </mesh>
        {/* Roof — carved rock at ground level */}
        <mesh position={[0, 10, 0]}>
          <boxGeometry args={[14, 0.5, 14]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.9} />
        </mesh>
      </group>

      {/* Steps / stairway on the west side */}
      {[0.5, 1.5, 2.5, 3.5].map((y, i) => (
        <mesh key={i} position={[-15, y, 0]}>
          <boxGeometry args={[2, 0.3, 3]} />
          <meshStandardMaterial color="#8a7a58" roughness={0.9} />
        </mesh>
      ))}

      {/* Info points */}
      <InfoPoint position={[0, 2, -18]} label="Bete Giyorgis — House of St. George. Carved top-down from a single volcanic tuff block in the 12th century." />
      <InfoPoint position={[16, 3, 0]} label="Trench — 11m deep, carved around the church to isolate it from the bedrock. Entered through a sloping passage." />
      <InfoPoint position={[0, 5, 14]} label="Cross Plan — The church is a perfect Greek cross, 12m x 12m. Windows and doors were carved after the exterior was shaped." />
    </group>
  );
}

function PitWall() {
  const pitSize = 22;
  const depth = 11;
  return (
    <group>
      {[
        { pos: [0, depth / 2, -pitSize / 2], size: [pitSize, depth, 0.5] },
        { pos: [0, depth / 2, pitSize / 2], size: [pitSize, depth, 0.5] },
        { pos: [-pitSize / 2, depth / 2, 0], size: [0.5, depth, pitSize] },
        { pos: [pitSize / 2, depth / 2, 0], size: [0.5, depth, pitSize] },
      ].map((w, i) => (
        <mesh key={i} position={w.pos as any}>
          <boxGeometry args={w.size as any} />
          <meshStandardMaterial color="#6a5a40" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ====================================================================
// Axum Obelisks Scene
// ====================================================================

function AxumScene() {
  const stelae = [
    { x: -30, z: 0, h: 24, w: 3.2, d: 1.5 },
    { x: -22, z: 8, h: 18, w: 2.6, d: 1.2 },
    { x: -14, z: -6, h: 15, w: 2.2, d: 1.0 },
    { x: -6, z: 5, h: 12, w: 1.8, d: 0.8 },
    { x: 4, z: -3, h: 20, w: 2.8, d: 1.3 },
    { x: 12, z: 7, h: 10, w: 1.5, d: 0.7 },
    { x: 20, z: -8, h: 14, w: 2.0, d: 0.9 },
    { x: 28, z: 4, h: 8, w: 1.2, d: 0.6 },
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#c8b890" roughness={0.9} />
      </mesh>

      {/* Stelae field */}
      {stelae.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <mesh position={[0, s.h / 2, 0]}>
            <boxGeometry args={[s.w, s.h, s.d]} />
            <meshStandardMaterial color="#8a7a58" roughness={0.85} />
          </mesh>
          {/* Carved "window" details — horizontal grooves */}
          {Array.from({ length: Math.floor(s.h / 3) }, (_, j) => (
            <mesh key={j} position={[0, (j + 1) * 3, s.d / 2 + 0.05]}>
              <boxGeometry args={[s.w * 0.7, 0.15, 0.05]} />
              <meshStandardMaterial color="#5a4a30" roughness={0.9} />
            </mesh>
          ))}
          {/* Same on the other side */}
          {Array.from({ length: Math.floor(s.h / 3) }, (_, j) => (
            <mesh key={j + 99} position={[0, (j + 1) * 3, -s.d / 2 - 0.05]}>
              <boxGeometry args={[s.w * 0.7, 0.15, 0.05]} />
              <meshStandardMaterial color="#5a4a30" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Info points */}
      <InfoPoint position={[-30, 14, 0]} label="Great Stele — 24m tall, 180 tons. The largest single piece of stone ever quarried in the ancient world." />
      <InfoPoint position={[4, 12, -3]} label="King Ezana's Stele — 20m tall, carved with multi-story palace window details. Marks Ezana's conversion to Christianity." />
      <InfoPoint position={[-8, 3, -15]} label="Kingdom of Aksum — 1st–8th century CE. A major trading empire connecting Africa, Arabia, and India." />
    </group>
  );
}
