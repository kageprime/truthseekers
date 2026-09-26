"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ClaimGraphNode, ClaimGraphEdge } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  supported: "#2b7a4b",
  weak: "#b87a2e",
  disputed: "#b33c3c",
  unknown: "#8a8a8a",
};

export interface ClaimConstellation3DProps {
  data: {
    nodes: (ClaimGraphNode & { article_slug?: string })[];
    edges: ClaimGraphEdge[];
  };
  selectedClaimId?: string | null;
  searchFilter?: string;
  height?: number;
  onNodeClick?: (n: ClaimGraphNode) => void;
  onWebGLUnavailable?: () => void;
}

interface PositionedNode {
  node: ClaimGraphNode & { article_slug?: string };
  pos: [number, number, number];
  color: string;
  size: number;
}

function CameraFlyController({
  targetPos,
  targetLookAt,
}: {
  targetPos: [number, number, number] | null;
  targetLookAt: [number, number, number] | null;
}) {
  const { camera } = useThree();
  const controlsRef = useThree((state) => (state as any).controls);

  useFrame(() => {
    if (targetPos) {
      camera.position.lerp(new THREE.Vector3(...targetPos), 0.06);
    }
    if (targetLookAt && controlsRef?.target) {
      controlsRef.target.lerp(new THREE.Vector3(...targetLookAt), 0.08);
      controlsRef.update();
    }
  });

  return null;
}

function ConstellationScene({
  data,
  selectedClaimId,
  searchFilter = "",
  onNodeClick,
  flyToId,
}: {
  data: ClaimConstellation3DProps["data"];
  selectedClaimId?: string | null;
  searchFilter?: string;
  onNodeClick?: (n: ClaimGraphNode) => void;
  flyToId?: string | null;
}) {
  const [hoveredNode, setHoveredNode] = useState<ClaimGraphNode | null>(null);

  const { positionedClaims, positionedEvidence, edgeLines, nodePosMap } = useMemo(() => {
    const claims = data.nodes.filter((n) => n.type === "claim");
    const evidence = data.nodes.filter((n) => n.type === "evidence");
    const posMap = new Map<string, [number, number, number]>();

    const radius = 38;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const pClaims: PositionedNode[] = [];

    claims.forEach((c, i) => {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(1, claims.length));
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const pos: [number, number, number] = [x, y, z];
      posMap.set(c.id, pos);

      const statusKey = (c.status || "unknown").toLowerCase();
      const col = STATUS_COLOR[statusKey] || STATUS_COLOR.unknown;
      const conf = typeof c.confidence === "number" ? c.confidence : 0.8;
      const size = 0.9 + conf * 0.9;
      pClaims.push({ node: c, pos, color: col, size });
    });

    const pEvidence: PositionedNode[] = [];
    evidence.forEach((ev, idx) => {
      const parentEdge = data.edges.find((e) => e.source === ev.id || e.target === ev.id);
      const parentId = parentEdge ? (parentEdge.source === ev.id ? parentEdge.target : parentEdge.source) : null;
      const parentPos = parentId ? posMap.get(parentId) : null;

      let pos: [number, number, number];
      if (parentPos) {
        const offsetAngle = (idx * 137.5 * Math.PI) / 180;
        const dist = 4.5 + (idx % 3) * 1.5;
        const ox = Math.cos(offsetAngle) * dist;
        const oy = ((idx % 5) - 2) * 1.5;
        const oz = Math.sin(offsetAngle) * dist;
        pos = [parentPos[0] + ox, parentPos[1] + oy, parentPos[2] + oz];
      } else {
        const seed = idx * 17;
        pos = [(seed % 20) - 10, ((seed * 3) % 20) - 10, ((seed * 7) % 20) - 10];
      }
      posMap.set(ev.id, pos);

      const isContraNode = ev.supports === false || ev.status === "disputed";
      const col = ev.supports === true ? "#2b7a4b" : isContraNode ? "#b33c3c" : "#8a8a8a";
      pEvidence.push({ node: ev, pos, color: col, size: 0.45 });
    });

    const points: THREE.Vector3[] = [];
    const colors: number[] = [];
    const supColor = new THREE.Color("#2b7a4b");
    const contraColor = new THREE.Color("#b33c3c");
    const neutralColor = new THREE.Color("#555555");

    data.edges.forEach((edge) => {
      const p1 = posMap.get(edge.source);
      const p2 = posMap.get(edge.target);
      if (p1 && p2) {
        points.push(new THREE.Vector3(...p1));
        points.push(new THREE.Vector3(...p2));
        const rel = String(edge.relationship || "").toLowerCase();
        const isContra = rel === "contradicts" || rel === "disputes";
        const isSup = rel === "supports";
        const edgeCol = isContra ? contraColor : isSup ? supColor : neutralColor;
        colors.push(edgeCol.r, edgeCol.g, edgeCol.b);
        colors.push(edgeCol.r, edgeCol.g, edgeCol.b);
      }
    });

    const edgeGeometry = new THREE.BufferGeometry().setFromPoints(points);
    edgeGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    return { positionedClaims: pClaims, positionedEvidence: pEvidence, edgeLines: edgeGeometry, nodePosMap: posMap };
  }, [data]);

  const query = searchFilter.trim().toLowerCase();

  const { flyPos, flyLookAt } = useMemo(() => {
    if (!flyToId) return { flyPos: null, flyLookAt: null };
    const p = nodePosMap.get(flyToId);
    if (!p) return { flyPos: null, flyLookAt: null };
    const vec = new THREE.Vector3(...p);
    const camTarget = vec.clone().add(vec.clone().normalize().multiplyScalar(16));
    return {
      flyPos: [camTarget.x, camTarget.y, camTarget.z] as [number, number, number],
      flyLookAt: p,
    };
  }, [flyToId, nodePosMap]);

  return (
    <>
      <CameraFlyController targetPos={flyPos} targetLookAt={flyLookAt} />
      <ambientLight intensity={0.7} />
      <pointLight position={[60, 60, 60]} intensity={1.2} />
      <pointLight position={[-60, -60, -60]} intensity={0.5} />

      <mesh>
        <sphereGeometry args={[37.8, 24, 24]} />
        <meshBasicMaterial wireframe color="#332c20" transparent opacity={0.06} />
      </mesh>

      {edgeLines && (
        <lineSegments geometry={edgeLines}>
          <lineBasicMaterial vertexColors transparent opacity={0.35} />
        </lineSegments>
      )}

      {positionedClaims.map((item) => {
        const text = (item.node.label || item.node.id).toLowerCase();
        const matchesSearch = query ? text.includes(query) : true;
        const isSelected = item.node.id === selectedClaimId;
        const isHovered = hoveredNode?.id === item.node.id;
        const shouldShowLabel = isSelected || isHovered || (query.length > 1 && matchesSearch);
        const opacity = query ? (matchesSearch ? 1 : 0.15) : 0.95;

        return (
          <group key={item.node.id} position={item.pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                if (onNodeClick) onNodeClick(item.node);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredNode(item.node);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredNode(null);
              }}
            >
              <sphereGeometry args={[item.size * (isSelected ? 1.4 : 1), 16, 16]} />
              <meshStandardMaterial
                color={item.color}
                emissive={isSelected ? item.color : "#000000"}
                emissiveIntensity={isSelected ? 0.6 : 0}
                roughness={0.35}
                transparent
                opacity={opacity}
              />
            </mesh>

            {isSelected && (
              <mesh>
                <sphereGeometry args={[item.size * 2, 16, 16]} />
                <meshBasicMaterial color="#b87a2e" wireframe transparent opacity={0.4} />
              </mesh>
            )}

            {shouldShowLabel && (
              <Html distanceFactor={45} center style={{ pointerEvents: "none" }}>
                <div
                  className="px-2 py-1 rounded text-[11px] font-serif shadow-lg whitespace-nowrap max-w-[220px] truncate"
                  style={{
                    background: "rgba(18, 17, 14, 0.92)",
                    color: "#f5f0e6",
                    border: `1px solid ${item.color}`,
                  }}
                >
                  <span className="font-mono text-[9px] uppercase tracking-wider block opacity-75">
                    {item.node.status || "claim"} · {(item.node.confidence ?? 0).toFixed(2)}
                  </span>
                  {item.node.label || item.node.id}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {positionedEvidence.map((item) => {
        const isSelected = item.node.id === selectedClaimId;
        const isHovered = hoveredNode?.id === item.node.id;
        const opacity = query ? 0.2 : 0.7;

        return (
          <group key={item.node.id} position={item.pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                if (onNodeClick) onNodeClick(item.node);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredNode(item.node);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredNode(null);
              }}
            >
              <sphereGeometry args={[item.size, 10, 10]} />
              <meshStandardMaterial color={item.color} roughness={0.6} transparent opacity={opacity} />
            </mesh>

            {(isHovered || isSelected) && (
              <Html distanceFactor={40} center style={{ pointerEvents: "none" }}>
                <div
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono shadow whitespace-nowrap"
                  style={{ background: "rgba(18, 17, 14, 0.9)", color: "#e0d8c8", border: "1px solid #666" }}
                >
                  {item.node.supports === true
                    ? "supports"
                    : item.node.supports === false || item.node.status === "disputed"
                    ? "contradicts"
                    : "evidence"}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={10} maxDistance={120} />
    </>
  );
}

export default function ClaimConstellation3D({
  data,
  selectedClaimId,
  searchFilter = "",
  height = 560,
  onNodeClick,
  onWebGLUnavailable,
}: ClaimConstellation3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flyToId, setFlyToId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClaimId) {
      setFlyToId(selectedClaimId);
    }
  }, [selectedClaimId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-[1.2rem] select-none"
      style={{
        height,
        background: "radial-gradient(ellipse at center, #181714 0%, #0d0c0a 100%)",
        border: "1px solid var(--rule)",
      }}
    >
      <Canvas
        camera={{ position: [0, 20, 68], fov: 48 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          if (!gl) {
            onWebGLUnavailable?.();
          }
        }}
      >
        <ConstellationScene
          data={data}
          selectedClaimId={selectedClaimId}
          searchFilter={searchFilter}
          onNodeClick={onNodeClick}
          flyToId={flyToId}
        />
      </Canvas>

      <div
        className="absolute top-2 left-2 flex flex-wrap gap-1.5 text-[10px] pointer-events-none max-w-[calc(100%-16px)]"
        style={{ color: "var(--muted)" }}
      >
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur"
            style={{
              background: "rgba(20, 19, 16, 0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e6decb",
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c }} /> {k}
          </span>
        ))}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur"
          style={{
            background: "rgba(20, 19, 16, 0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e6decb",
          }}
        >
          <span className="h-1.5 w-2 rounded" style={{ background: "#2b7a4b" }} /> supports
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur"
          style={{
            background: "rgba(20, 19, 16, 0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e6decb",
          }}
        >
          <span className="h-1.5 w-2 rounded" style={{ background: "#b33c3c" }} /> contradicts
        </span>
      </div>

      <div
        className="absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-[10px] backdrop-blur pointer-events-none"
        style={{
          color: "#99907c",
          background: "rgba(20, 19, 16, 0.75)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        drag to rotate · scroll to zoom · click node to inspect
      </div>
    </div>
  );
}

