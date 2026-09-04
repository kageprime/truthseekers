"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphNode, GraphLink } from "@/lib/api";

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface SimNode extends GraphNode {
  x: number; y: number; vx: number; vy: number;
}

interface SimLink {
  source: SimNode; target: SimNode; type: string;
}

function forceSimulation(nodes: SimNode[], links: SimLink[], width: number, height: number) {
  const centerX = width / 2, centerY = height / 2;
  const repulsion = 800, attraction = 0.005, damping = 0.9;

  for (const n of nodes) {
    if (n.x === undefined) { n.x = centerX + (Math.random() - 0.5) * 200; n.y = centerY + (Math.random() - 0.5) * 200; }
    n.vx ??= 0; n.vy ??= 0;
  }

  for (let iter = 0; iter < 150; iter++) {
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      }
    }

    // attraction (links)
    for (const l of links) {
      const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      l.source.vx += dx * attraction;
      l.source.vy += dy * attraction;
      l.target.vx -= dx * attraction;
      l.target.vy -= dy * attraction;
    }

    // center gravity
    for (const n of nodes) {
      n.vx += (centerX - n.x) * 0.001;
      n.vy += (centerY - n.y) * 0.001;
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= damping;
      n.vy *= damping;
    }
  }
}

export default function ClaimGraph({ nodes, links }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dim, setDim] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (svgRef.current?.parentElement) {
        const { clientWidth, clientHeight } = svgRef.current.parentElement;
        setDim({ w: clientWidth, h: clientHeight });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!nodes.length) return (
    <div className="flex items-center justify-center h-full text-subtle text-xs">
      No claim graph data available
    </div>
  );

  const simNodes: SimNode[] = nodes.map((n) => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simLinks: SimLink[] = links
    .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
    .map((l) => ({ source: nodeMap.get(l.source)!, target: nodeMap.get(l.target)!, type: l.type }));

  forceSimulation(simNodes, simLinks, dim.w, dim.h);

  const typedSet = new Set(simLinks.filter((l) => l.type === "supports" || l.type === "contradicts"));

  const nodeRadius = (n: SimNode) => (n.type === "article" ? 13 : 7);
  const nodeFill = (n: SimNode) => {
    if (n.type === "article") return "var(--gold)";
    if (n.status === "supported") return "#3b8c5e";
    if (n.status === "disputed") return "#c84a4a";
    return "var(--subtle)";
  };

  // Neighbor cluster of the hovered node.
  const cluster = hover ? new Set<string>([hover]) : null;
  if (cluster) {
    for (const l of simLinks) {
      const s = l.source.id, t = l.target.id;
      if (s === hover || t === hover) { cluster.add(s); cluster.add(t); }
    }
  }

  return (
    <svg ref={svgRef} width={dim.w} height={dim.h} className="select-none"
      onPointerLeave={() => setHover(null)}>
      <defs>
        <radialGradient id="cg-node" cx="35%" cy="30%" r="90%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
        </radialGradient>
        <filter id="cg-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="cg-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
        </marker>
      </defs>

      {simLinks.map((l, i) => {
        const inCluster = cluster ? cluster.has(l.source.id) && cluster.has(l.target.id) : true;
        const active = hover ? inCluster : true;
        const dx = l.target.x - l.source.x;
        const dy = l.target.y - l.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const tr = nodeRadius(l.target) + 2;
        return (
          <line
            key={i}
            x1={l.source.x} y1={l.source.y}
            x2={l.target.x - ux * tr} y2={l.target.y - uy * tr}
            stroke={typedSet.has(l)
              ? (l.type === "supports" ? "var(--green, #3b8c5e)" : "var(--red, #c84a4a)")
              : "var(--subtle)"}
            strokeWidth={active ? (typedSet.has(l) ? 1.5 : 1.2) : 0.5}
            strokeOpacity={active ? 0.75 : 0.12}
            markerEnd={typedSet.has(l) ? "url(#cg-arrow)" : undefined}
          />
        );
      })}

      {simNodes.map((n) => {
        const inCluster = cluster ? cluster.has(n.id) : true;
        const isHover = hover === n.id;
        const active = hover ? inCluster : true;
        const r = nodeRadius(n);
        const fill = nodeFill(n);
        return (
          <g key={n.id}
            onPointerEnter={() => setHover(n.id)}
            style={{ cursor: "pointer", opacity: active ? 1 : 0.28, transition: "opacity 0.2s" }}>
            {isHover && (
              <circle cx={n.x} cy={n.y} r={r + 6} fill="none"
                stroke="var(--accent)" strokeWidth={1.2} strokeOpacity={0.7} />
            )}
            <circle
              cx={n.x} cy={n.y} r={r * (isHover ? 1.15 : 1)}
              fill={fill} stroke="transparent"
              filter={n.type === "article" ? "url(#cg-glow)" : undefined}
              style={{ transition: "r 0.2s" }}
            />
            <circle cx={n.x} cy={n.y} r={r} fill="url(#cg-node)" pointerEvents="none" />
            <text
              x={n.x} y={n.y + r + 14}
              textAnchor="middle" fill="var(--ink)" fillOpacity={active ? 0.9 : 0.3}
              fontSize={n.type === "article" ? 11 : 9}
              fontWeight={n.type === "article" ? 600 : 500}
              fontFamily="var(--font-display), Georgia, serif"
              pointerEvents="none"
            >
              {n.type === "article" ? n.label : n.label.slice(0, 34) + (n.label.length > 34 ? "…" : "")}
            </text>
            <title>{n.id} — {n.label} ({n.status ?? "unknown"})</title>
          </g>
        );
      })}
    </svg>
  );
}
