"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchArticleClaimGraph, type ClaimGraphNode, type ClaimGraphEdge } from "@/lib/api";
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

export default function ClaimGraphViewer({ slug }: { slug: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<{ nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClaimGraphNode | null>(null);
  const simRef = useRef<Sim | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchArticleClaimGraph(slug).then((res) => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    });
    return () => {
      alive = false;
      simRef.current?.destroy();
    };
  }, [slug]);

  const onSelect = useCallback((n: ClaimGraphNode | null) => setSelected(n), []);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const sim = new Sim(canvasRef.current, data.nodes, data.edges, onSelect);
    simRef.current = sim;
    return () => {
      sim.destroy();
      simRef.current = null;
    };
  }, [data, onSelect]);

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
    <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: "var(--border, #e5e5e5)", background: "#faf9f6" }}>
      <div className="relative" style={{ height: 480 }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-2 text-[9px] pointer-events-none" style={{ color: "var(--muted, #777)" }}>
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/80 border" style={{ borderColor: "var(--border, #e5e5e5)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {k}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/80 border" style={{ borderColor: "var(--border, #e5e5e5)" }}>
            <span className="w-2 h-1.5 rounded" style={{ background: "#2b7a4b" }} /> supports
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/80 border" style={{ borderColor: "var(--border, #e5e5e5)" }}>
            <span className="w-2 h-1.5 rounded" style={{ background: "#b33c3c" }} /> contradicts
          </span>
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded text-[9px] bg-white/80 border pointer-events-none" style={{ color: "var(--subtle, #999)", borderColor: "var(--border, #e5e5e5)" }}>
          drag to move · scroll to zoom
        </div>
      </div>

      {selectedFull && (
        <div className="p-3 border-t" style={{ borderColor: "var(--border, #e5e5e5)" }}>
          <div className="flex items-start gap-3">
            <ConfidenceRadar vector={selectedFull.confidence_vector} size={130} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{
                  background: (STATUS_COLOR[selectedFull.status || "unknown"] || "#8a8a8a") + "22",
                  color: STATUS_COLOR[selectedFull.status || "unknown"] || "#8a8a8a",
                }}>
                  {selectedFull.status || selectedFull.type}
                </span>
                {selectedFull.type === "claim" && selectedFull.confidence != null && (
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--muted, #777)" }}>
                    confidence {selectedFull.confidence.toFixed(2)}
                  </span>
                )}
                <button onClick={() => onSelect(null)} className="ml-auto text-[10px] cursor-pointer" style={{ color: "var(--subtle, #999)" }}>✕</button>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink)" }}>
                {selectedFull.label || selectedFull.id}
              </p>
              {selectedFull.type === "evidence" && (
                <p className="text-[10px] mt-1 break-all" style={{ color: "var(--subtle, #999)" }}>
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
  private dragNode: PNode | null = null;
  private panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private nodeIndex = new Map<string, PNode>();
  private onSelect: (n: ClaimGraphNode | null) => void;

  constructor(canvas: HTMLCanvasElement, nodes: ClaimGraphNode[], edges: ClaimGraphEdge[], onSelect: (n: ClaimGraphNode | null) => void) {
    this.onSelect = onSelect;
    this.ctx = canvas.getContext("2d")!;
    this.edges = edges;

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
    window.addEventListener("resize", size);

    this.loop();
  }

  private loop = () => {
    this.step();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private step() {
    const nodes = this.nodes;
    if (nodes.length === 0) return;
    const W = this.W;
    const H = this.H;
    const repulsion = 4200;
    const attraction = 0.02;
    const centering = 0.02;
    const damping = 0.85;

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
    }
  }

  private draw() {
    const { ctx, W, H, dpr, offsetX, offsetY, zoom } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    for (const e of this.edges) {
      const s = this.nodeIndex.get(e.source);
      const t = this.nodeIndex.get(e.target);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = this.edgeColor(e.relationship);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const n of this.nodes) {
      const d = n.data;
      const r = d.type === "evidence" ? 4 : 6 + (d.confidence ? d.confidence * 14 : 6);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = d.type === "evidence" ? "#9a9a9a" : STATUS_COLOR[d.status || "unknown"] || "#8a8a8a";
      ctx.globalAlpha = d.type === "evidence" ? 0.7 : 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (d.type === "claim") {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
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
    let bestD = 22;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      const rr = (n.data.type === "evidence" ? 4 : 6 + (n.data.confidence ? n.data.confidence * 14 : 6)) + 6;
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
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = (this.ctx.canvas as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (this.dragNode) {
      this.dragNode.x = (px - this.offsetX) / this.zoom;
      this.dragNode.y = (py - this.offsetY) / this.zoom;
    } else if (this.panning) {
      this.offsetX = px - this.panStartX;
      this.offsetY = py - this.panStartY;
    }
  };

  private onPointerUp = () => {
    if (this.dragNode) {
      this.onSelect(this.dragNode.data);
      this.dragNode.fixed = false;
      this.dragNode = null;
      (this.ctx.canvas as HTMLCanvasElement).style.cursor = "default";
      return;
    }
    this.panning = false;
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
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    const c = this.ctx.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointerleave", this.onPointerUp);
    c.removeEventListener("wheel", this.onWheel);
  }
}

