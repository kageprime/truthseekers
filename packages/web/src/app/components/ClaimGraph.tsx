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

  const nodeRadius = (n: SimNode) => n.type === "article" ? 10 : 6;
  const nodeColor = (n: SimNode) => {
    if (n.type === "article") return "#c8a45a";
    if (n.status === "supported") return "#3b8c5e";
    if (n.status === "disputed") return "#c84a4a";
    return "#6b7280";
  };

  return (
    <svg ref={svgRef} width={dim.w} height={dim.h} className="select-none">
      <defs>
        {simNodes.map((n) => (
          <filter key={n.id} id={`glow-${n.id}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>
      {simLinks.map((l, i) => (
        <line
          key={i}
          x1={l.source.x} y1={l.source.y}
          x2={l.target.x} y2={l.target.y}
          stroke="#374151" strokeWidth={0.5} strokeOpacity={0.4}
        />
      ))}
      {simNodes.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.x} cy={n.y} r={nodeRadius(n)}
            fill={nodeColor(n)} stroke="none"
            opacity={0.9}
            filter={`url(#glow-${n.id})`}
          />
          <text
            x={n.x} y={n.y + nodeRadius(n) + 10}
            textAnchor="middle" fill="#9ca3af"
            fontSize={n.type === "article" ? 10 : 8}
            fontFamily="inherit"
          >
            {n.type === "article" ? n.label : n.label.slice(0, 40) + (n.label.length > 40 ? "…" : "")}
          </text>
          <title>{n.id} — {n.label} ({n.status ?? "unknown"})</title>
        </g>
      ))}
    </svg>
  );
}
