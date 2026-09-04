"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useArticleClaimGraph } from "../hooks";
import type { ClaimGraphNode, ClaimGraphEdge } from "@/lib/api";
import ConfidenceRadar from "./ConfidenceRadar";

// ClaimGraphViewer renders an article's claim graph as a force-directed canvas
// visualization (custom Verlet simulation — no graph library). Claim nodes are
// colored by status and sized by confidence; evidence nodes are small gray
// dots. Click a claim to inspect it (text + confidence radar).

const STATUS_COLOR: Record<string, string> = {
  supported: "#2b7a4b",
  weak: "#b87a2e",
  disputed: "#b33c3c",
  unknown: "#8a8a8a",
};

export default function ClaimGraphViewer({
  slug,
  data: externalData,
  loading: externalLoading,
  height = 520,
  onNodeClick,
}: {
  slug?: string;
  data?: { nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[] } | null;
  loading?: boolean;
  height?: number;
  onNodeClick?: (n: ClaimGraphNode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fetched = useArticleClaimGraph(slug);
  const data = externalData !== undefined ? externalData : fetched.data;
  const loading = externalLoading !== undefined ? externalLoading : fetched.loading;
  const [selected, setSelected] = useState<ClaimGraphNode | null>(null);
  const simRef = useRef<Sim | null>(null);

  const handleSelect = useCallback(
    (n: ClaimGraphNode | null) => {
      setSelected(n);
      if (n && onNodeClick) onNodeClick(n);
    },
    [onNodeClick]
  );

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const sim = new Sim(canvasRef.current, data.nodes, data.edges, handleSelect);
    simRef.current = sim;
    return () => {
      sim.destroy();
      simRef.current = null;
    };
  }, [data, handleSelect]);

  if (loading) {
    return <div className="py-12 text-center text-xs" style={{ color: "var(--subtle)" }}>Loading claim graph…</div>;
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="py-12 text-center text-xs" style={{ color: "var(--subtle)" }}>
        No claim graph yet — this article predates epistemic tracking, or has no claims.
      </div>
    );
  }

  const selectedFull = selected ? data.nodes.find((n) => n.id === selected.id) || selected : null;

  return (
    <div className="relative my-4 overflow-hidden rounded-[1.2rem]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="relative" style={{ height }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 text-[10px] pointer-events-none max-w-[calc(100%-8px)]" style={{ color: "var(--muted)" }}>
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur" style={{ background: "color-mix(in srgb, var(--surface-elevated) 72%, transparent)", border: "1px solid var(--border)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c }} /> {k}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur" style={{ background: "color-mix(in srgb, var(--surface-elevated) 72%, transparent)", border: "1px solid var(--border)" }}>
            <span className="h-1.5 w-2 rounded" style={{ background: "#2b7a4b" }} /> supports
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur" style={{ background: "color-mix(in srgb, var(--surface-elevated) 72%, transparent)", border: "1px solid var(--border)" }}>
            <span className="h-1.5 w-2 rounded" style={{ background: "#b33c3c" }} /> contradicts
          </span>
        </div>
        <div className="absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-[10px] backdrop-blur pointer-events-none" style={{ color: "var(--subtle)", background: "color-mix(in srgb, var(--surface-elevated) 72%, transparent)", border: "1px solid var(--border)" }}>
          drag to move · scroll to zoom
        </div>
      </div>

      {selectedFull && !onNodeClick && (
        <div className="relative border-t p-4" style={{ borderColor: "var(--rule)" }}>
          <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--gold), transparent)" }} />
          <div className="flex items-start gap-4">
            <ConfidenceRadar vector={selectedFull.confidence_vector} size={132} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="small-caps text-[10px] tracking-[0.14em] rounded-full px-2 py-0.5" style={{
                  background: (STATUS_COLOR[selectedFull.status || "unknown"] || "#8a8a8a") + "1f",
                  color: STATUS_COLOR[selectedFull.status || "unknown"] || "#8a8a8a",
                  border: "1px solid " + ((STATUS_COLOR[selectedFull.status || "unknown"] || "#8a8a8a") + "55"),
                }}>
                  {selectedFull.status || selectedFull.type}
                </span>
                {selectedFull.type === "claim" && selectedFull.confidence != null && (
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
                    confidence {selectedFull.confidence.toFixed(2)}
                  </span>
                )}
                <button onClick={() => handleSelect(null)} className="ml-auto small-caps text-[10px] tracking-[0.12em] cursor-pointer transition-opacity hover:opacity-60" style={{ color: "var(--subtle)", background: "none", border: "none" }}>✕</button>
              </div>
              <p className="font-display text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                {selectedFull.label || selectedFull.id}
              </p>
              {selectedFull.type === "evidence" && (
                <p className="text-[10px] mt-1.5 break-all leading-relaxed" style={{ color: "var(--subtle)" }}>
                  {selectedFull.chain_of_custody ? `chain: ${selectedFull.chain_of_custody}` : ""} {(selectedFull.supports ? "supports" : "contradicts")} · {selectedFull.accessibility || "public"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Force-directed simulation (custom, dependency-free) ──

type PNode = { id: string; x: number; y: number; vx: number; vy: number; fixed: boolean; data: ClaimGraphNode };

class Sim {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private nodes: PNode[] = [];
  private edges: ClaimGraphEdge[] = [];
  private W = 0;
  private H = 0;
  private dpr = 1;
  private offsetX = 0;
  private offsetY = 0;
  private zoom = 1;
  private isDark = false;
  private txtMuted = "#6b6048";
  private hover: PNode | null = null;
  private fitted = false;
  private frame = 0;
  private dragNode: PNode | null = null;
  private panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private nodeIndex = new Map<string, PNode>();
  private onSelect: (n: ClaimGraphNode | null) => void;
  // ponytail: settling gate. Once the system has less kinetic energy than
  // SETTLE_KE and no interaction is in flight, the rAF loop is paused. Any
  // real interaction (drag, pan, wheel, hover change) calls wake() to
  // restart it. If throughput matters later, switch to per-node sleep flags.
  private settled = false;
  private static readonly SETTLE_KE = 0.5;
  private static readonly SETTLE_MIN_FRAME = 80;

  constructor(canvas: HTMLCanvasElement, nodes: ClaimGraphNode[], edges: ClaimGraphEdge[], onSelect: (n: ClaimGraphNode | null) => void) {
    this.onSelect = onSelect;
    this.ctx = canvas.getContext("2d")!;
    this.edges = edges;

    // Theme-aware ink colors (read the live CSS variables).
    const cs = getComputedStyle(document.documentElement);
    const surf = cs.getPropertyValue("--surface").trim();
    this.isDark = /^#/.test(surf)
      ? (parseInt(surf.slice(1, 3), 16) + parseInt(surf.slice(3, 5), 16) + parseInt(surf.slice(5, 7), 16)) < 260
      : false;
    this.txtMuted = cs.getPropertyValue("--muted").trim() || (this.isDark ? "#948868" : "#6b6048");

    const size = () => {
      const rect = (canvas.parentElement as HTMLElement).getBoundingClientRect();
      this.dpr = Math.max(1, window.devicePixelRatio || 1);
      this.W = rect.width;
      this.H = rect.height;
      canvas.width = this.W * this.dpr;
      canvas.height = this.H * this.dpr;
      canvas.style.width = this.W + "px";
      canvas.style.height = this.H + "px";
    };
    size();

    const N = nodes.length;
    nodes.forEach((n, i) => {
      const ang = (i / N) * Math.PI * 2;
      const r = Math.min(this.W, this.H) * 0.32;
      const node: PNode = { id: n.id, x: this.W / 2 + r * Math.cos(ang), y: this.H / 2 + r * Math.sin(ang), vx: 0, vy: 0, fixed: false, data: n };
      this.nodes.push(node);
      this.nodeIndex.set(n.id, node);
    });

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", this.onResize);

    this.loop();
  }

  // ponytail: restart the rAF loop after any real perturbation (drag, pan,
  // zoom, hover change, data swap). Scheduling an already-pending loop is a
  // no-op so wake() is safe to call liberally from hot paths.
  wake() {
    if (this.raf) return;
    this.settled = false;
    this.loop();
  }

  private onResize = () => {
    const rect = (this.ctx.canvas as HTMLCanvasElement).parentElement!.getBoundingClientRect();
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.W = rect.width;
    this.H = rect.height;
    (this.ctx.canvas as HTMLCanvasElement).width = this.W * this.dpr;
    (this.ctx.canvas as HTMLCanvasElement).height = this.H * this.dpr;
    (this.ctx.canvas as HTMLCanvasElement).style.width = this.W + "px";
    (this.ctx.canvas as HTMLCanvasElement).style.height = this.H + "px";
    this.wake();
  };

  private loop = () => {
    const ke = this.step();
    this.draw();
    this.frame++;
    if (!this.fitted && this.frame > Sim.SETTLE_MIN_FRAME) {
      this.fitOnce();
      this.fitted = true;
    }
    // Pause the loop once the system carries less than SETTLE_KE worth of
    // kinetic energy and has had time to fit. wake() restarts it on the next
    // user perturbation; the final frame paints the resting state.
    if (this.frame > Sim.SETTLE_MIN_FRAME && ke < Sim.SETTLE_KE) {
      if (this.selectedForSettleChanged) {
        this.selectedForSettleChanged = false;
        this.raf = requestAnimationFrame(this.loop);
        return;
      }
      this.settled = true;
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  // selectedForSettleChanged is flipped when the keyed hover/select state
  // changes; it nudges the loop for one extra frame so the highlight retint
  // is applied before pausing.
  private selectedForSettleChanged = false;

  private fitOnce() {
    if (this.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    const bw = maxX - minX, bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return;
    const pad = 92; // room for labels below nodes
    const z = Math.max(0.35, Math.min(1.3, Math.min((this.W - pad) / bw, (this.H - pad) / bh)));
    this.zoom = z;
    this.offsetX = this.W / 2 - ((minX + maxX) / 2) * z;
    this.offsetY = this.H / 2 - ((minY + maxY) / 2) * z;
  }

  private step(): number {
    const nodes = this.nodes;
    if (nodes.length === 0) return 0;
    const W = this.W;
    const H = this.H;
    const repulsion = 4200;
    const attraction = 0.02;
    const centering = 0.02;
    const damping = 0.82;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        const f = (repulsion / d2) * 0.5;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    }

    for (const e of this.edges) {
      const s = this.nodeIndex.get(e.source);
      const t = this.nodeIndex.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const ideal = 60 + (s.data.type === "evidence" ? 25 : 20);
      const f = (d - ideal) * attraction;
      s.vx += (dx / d) * f;
      s.vy += (dy / d) * f;
      t.vx -= (dx / d) * f;
      t.vy -= (dy / d) * f;
    }

    const cx = W / 2;
    const cy = H / 2;
    let ke = 0;
    for (const n of nodes) {
      if (n.fixed) continue;
      n.vx += (cx - n.x) * centering;
      n.vy += (cy - n.y) * centering;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(20, Math.min(W - 20, n.x));
      n.y = Math.max(20, Math.min(H - 20, n.y));
      ke += n.vx * n.vx + n.vy * n.vy;
    }
    return ke;
  }

  private nodeRadius(n: PNode): number {
    const d = n.data;
    return d.type === "evidence" ? 4 : 8 + (d.confidence ? d.confidence * 12 : 6);
  }

  private truncate(s: string, max: number): string {
    const t = String(s || "");
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
  }

  private hexA(hex: string, a: number): string {
    const c = hex.replace("#", "");
    if (c.length < 6) return hex;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  private roundedRect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private draw() {
    const { ctx, W, H, dpr, offsetX, offsetY, zoom } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Subtle screened dot-grid (decorative, pan/zoom aligned).
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);
    ctx.fillStyle = this.isDark ? "rgba(212,168,83,0.05)" : "rgba(166,124,47,0.06)";
    const gs = 30 / zoom;
    for (let gx = offsetX % gs - gs; gx < W; gx += gs) {
      for (let gy = offsetY % gs - gs; gy < H; gy += gs) {
        ctx.beginPath();
        ctx.arc((gx - offsetX) / zoom, (gy - offsetY) / zoom, 0.7 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nodes adjacent to the hovered node form a highlighted cluster.
    const hoverId = this.hover?.id;
    const cluster = hoverId ? new Set<string>([hoverId]) : null;
    if (cluster) {
      for (const e of this.edges) {
        if (e.source === hoverId || e.target === hoverId) {
          cluster.add(e.source);
          cluster.add(e.target);
        }
      }
    }

    // Edges (behind nodes), with directional arrowheads for typed relations.
    for (const e of this.edges) {
      const s = this.nodeIndex.get(e.source);
      const t = this.nodeIndex.get(e.target);
      if (!s || !t) continue;
      const rel = e.relationship;
      const base = this.edgeColor(rel);
      const inCluster = cluster ? cluster.has(e.source) && cluster.has(e.target) : null;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const ang = Math.atan2(t.y - s.y, t.x - s.x);
      const tr = this.nodeRadius(t) + (rel === "supports" || rel === "contradicts" ? 6 : 3);
      const ax = t.x - Math.cos(ang) * tr;
      const ay = t.y - Math.sin(ang) * tr;
      ctx.lineTo(ax, ay);

      if (rel === "supports" || rel === "contradicts") {
        if (cluster) {
          ctx.globalAlpha = inCluster === true ? 0.9 : 0.16;
          ctx.strokeStyle = base;
          ctx.lineWidth = inCluster === true ? 1.7 : 1;
        } else {
          ctx.globalAlpha = this.hover ? 0.5 : 0.68;
          ctx.strokeStyle = base;
          ctx.lineWidth = 1.2;
        }
      } else {
        ctx.globalAlpha = cluster ? (inCluster === true ? 0.5 : 0.1) : 0.3;
        ctx.strokeStyle = this.isDark ? "rgba(150,150,150,0.6)" : "rgba(120,120,120,0.45)";
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      if (rel === "supports" || rel === "contradicts") {
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -3.6);
        ctx.lineTo(-3, 3.6);
        ctx.closePath();
        ctx.globalAlpha = cluster ? (inCluster === true ? 0.9 : 0.4) : 0.8;
        ctx.fillStyle = base;
        ctx.fill();
      }
      ctx.restore();
    }

    // Nodes with radial glow + rim; claim labels drawn last.
    for (const n of this.nodes) {
      const d = n.data;
      const r = this.nodeRadius(n);
      const fill = d.type === "evidence"
        ? (this.isDark ? "#6b6f76" : "#9aa0a8")
        : STATUS_COLOR[d.status || "unknown"] || "#8a8a8a";
      const inCluster = cluster ? cluster.has(n.id) : true;
      const alpha = cluster ? (inCluster ? 1 : 0.22) : 1;

      if (d.type === "claim") {
        const glow = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, r * 2.9);
        glow.addColorStop(0, this.hexA(fill, 0.30 * alpha));
        glow.addColorStop(1, this.hexA(fill, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.9, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = d.type === "evidence" ? 0.72 * alpha : 0.96 * alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (d.type === "claim") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.isDark ? "rgba(13,11,9,0.9)" : "rgba(255,253,247,0.95)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    // Labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const n of this.nodes) {
      const d = n.data;
      if (d.type === "evidence") continue;
      const r = this.nodeRadius(n);
      const inCluster = cluster ? cluster.has(n.id) : true;
      const isHover = this.hover?.id === n.id;
      const label = this.truncate(d.label || d.id, isHover ? 44 : 30);
      ctx.font = `600 ${(isHover ? 13.5 : 12) / zoom}px Georgia, 'Times New Roman', serif`;
      const tw = ctx.measureText(label).width;
      const ty = n.y + r + 6 / zoom;
      ctx.globalAlpha = (inCluster ? 1 : 0.15) * (isHover ? 1 : 0.82);
      ctx.fillStyle = this.isDark ? "rgba(22,18,14,0.72)" : "rgba(255,253,247,0.86)";
      this.roundedRect(n.x - tw / 2 - 5 / zoom, ty - 1 / zoom, tw + 10 / zoom, 16 / zoom, 4 / zoom);
      ctx.fill();
      ctx.fillStyle = this.hexA(this.txtMuted, isHover ? 1 : 0.85);
      ctx.fillText(label, n.x, ty);
    }
    ctx.restore();
  }

  private edgeColor(rel: string): string {
    switch (rel) {
      case "supports":
        return "#2b7a4b";
      case "contradicts":
        return "#b33c3c";
      default:
        return "#b7b7b7";
    }
  }

  private hitTest(px: number, py: number): PNode | null {
    const wx = (px - this.offsetX) / this.zoom;
    const wy = (py - this.offsetY) / this.zoom;
    let best: PNode | null = null;
    let bestD = 26;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      const rr = this.nodeRadius(n) + 7;
      if (d < rr && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  private onPointerDown = (e: PointerEvent) => {
    const rect = (this.ctx.canvas as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const node = this.hitTest(px, py);
    if (node) {
      this.dragNode = node;
      node.fixed = true;
      (this.ctx.canvas as HTMLCanvasElement).style.cursor = "grabbing";
    } else {
      this.panning = true;
      this.panStartX = px - this.offsetX;
      this.panStartY = py - this.offsetY;
      this.onSelect(null);
    }
    this.wake();
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = (this.ctx.canvas as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (this.dragNode) {
      this.dragNode.x = (px - this.offsetX) / this.zoom;
      this.dragNode.y = (py - this.offsetY) / this.zoom;
      this.wake();
    } else if (this.panning) {
      this.offsetX = px - this.panStartX;
      this.offsetY = py - this.panStartY;
      this.wake();
    } else {
      const node = this.hitTest(px, py);
      const changed = (node?.id ?? null) !== (this.hover?.id ?? null);
      this.hover = node;
      (this.ctx.canvas as HTMLCanvasElement).style.cursor = node ? "pointer" : "default";
      if (changed) {
        this.selectedForSettleChanged = true;
        this.wake();
      }
    }
  };

  private onPointerUp = () => {
    if (this.dragNode) {
      this.onSelect(this.dragNode.data);
      this.dragNode.fixed = false;
      this.dragNode = null;
      (this.ctx.canvas as HTMLCanvasElement).style.cursor = "default";
      this.wake();
      return;
    }
    this.panning = false;
    this.hover = null;
    (this.ctx.canvas as HTMLCanvasElement).style.cursor = "default";
    this.wake();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = (this.ctx.canvas as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(3, this.zoom * factor));
    const wx = (px - this.offsetX) / this.zoom;
    const wy = (py - this.offsetY) / this.zoom;
    this.offsetX = px - wx * newZoom;
    this.offsetY = py - wy * newZoom;
    this.zoom = newZoom;
    this.wake();
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener("resize", this.onResize);
    const c = this.ctx.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointerleave", this.onPointerUp);
    c.removeEventListener("wheel", this.onWheel);
  }
}

