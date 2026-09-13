"use client";
import { useEffect, useRef } from "react";
import type { ClaimGraphEdge, ClaimGraphNode } from "@/lib/api";
import { retroStatusColor } from "@/lib/retro";

// ponytail: canvas port of ClaimGraphViewer Sim — same physics/settle/pan/zoom, retro skin only.
type PNode = { id: string; x: number; y: number; vx: number; vy: number; fixed: boolean; data: ClaimGraphNode };

class RetroSim {
  private ctx: CanvasRenderingContext2D;
  private raf = 0; private nodes: PNode[] = []; private edges: ClaimGraphEdge[] = [];
  private W = 0; private H = 0; private dpr = 1; private offsetX = 0; private offsetY = 0; private zoom = 1;
  private hover: PNode | null = null; private fitted = false; private frame = 0;
  private dragNode: PNode | null = null; private panning = false; private panStartX = 0; private panStartY = 0;
  private nodeIndex = new Map<string, PNode>();
  private settled = false; private static readonly SETTLE_KE_PER_NODE = 0.02; private static readonly SETTLE_MIN = 80;
  private frozen = false;
  private selChanged = false; private selectedId: string | null; private centralId: string | null;
  constructor(private canvas: HTMLCanvasElement, nodes: ClaimGraphNode[], edges: ClaimGraphEdge[], private onSelect: (n: ClaimGraphNode | null) => void, selectedId: string | null, centralId: string | null) {
    this.ctx = canvas.getContext("2d")!;
    this.edges = edges; this.selectedId = selectedId; this.centralId = centralId;
    this.size();
    const N = nodes.length;
    nodes.forEach((n, i) => {
      const ang = (i / Math.max(1, N)) * Math.PI * 2;
      const r = Math.min(this.W, this.H) * 0.32;
      const node = { id: n.id, x: this.W / 2 + r * Math.cos(ang), y: this.H / 2 + r * Math.sin(ang), vx: 0, vy: 0, fixed: false, data: n };
      this.nodes.push(node); this.nodeIndex.set(n.id, node);
    });
    canvas.addEventListener("pointerdown", this.down); canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up); canvas.addEventListener("pointerleave", this.up);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    window.addEventListener("resize", this.resize);
    this.loop();
  }
  setSelected(id: string | null) { this.selectedId = id; this.selChanged = true; this.paint(); }
  setFrozen(f: boolean) {
    this.frozen = f;
    if (f) { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.settled = true; this.draw(); }
    else { this.wake(); }
  }
  // ponytail: single-frame repaint for hover/selection — never restarts the loop.
  paint() { if (!this.raf) this.draw(); else this.selChanged = true; }
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.canvas.removeEventListener("pointerdown", this.down); this.canvas.removeEventListener("pointermove", this.move); this.canvas.removeEventListener("pointerup", this.up); this.canvas.removeEventListener("pointerleave", this.up); this.canvas.removeEventListener("wheel", this.wheel); window.removeEventListener("resize", this.resize); }
  wake() { if (this.raf || this.frozen) return; this.settled = false; this.loop(); }
  private size() { const rect = (this.canvas.parentElement as HTMLElement).getBoundingClientRect(); this.dpr = Math.max(1, window.devicePixelRatio || 1); this.W = rect.width; this.H = rect.height; this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr; this.canvas.style.width = this.W + "px"; this.canvas.style.height = this.H + "px"; }
  private resize = () => { this.size(); this.wake(); };
  private toWorld(e: PointerEvent) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - this.offsetX) / this.zoom, y: (e.clientY - r.top - this.offsetY) / this.zoom }; }
  private pick(p: { x: number; y: number }): PNode | null { let best: PNode | null = null, bd = Infinity; for (const n of this.nodes) { const r = this.radius(n) + 6; const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < r && d < bd) { bd = d; best = n; } } return best; }
  private down = (e: PointerEvent) => { this.canvas.setPointerCapture(e.pointerId); const n = this.pick(this.toWorld(e)); if (n) { this.dragNode = n; n.fixed = true; } else { this.panning = true; this.panStartX = e.clientX - this.offsetX; this.panStartY = e.clientY - this.offsetY; } this.wake(); };
  private move = (e: PointerEvent) => {
    const p = this.toWorld(e);
    if (this.dragNode) { this.dragNode.x = p.x; this.dragNode.y = p.y; this.dragNode.vx = 0; this.dragNode.vy = 0; this.wake(); return; }
    if (this.panning) { this.offsetX = e.clientX - this.panStartX; this.offsetY = e.clientY - this.panStartY; if (!this.settled) this.wake(); else this.draw(); return; }
    // ponytail: hover only repaints — restarting the loop on every flyover kept 150 nodes in perpetual motion.
    const h = this.pick(p); if ((h?.id ?? null) !== (this.hover?.id ?? null)) { this.hover = h; this.paint(); }
  };
  private up = (e: PointerEvent) => {
    if (this.dragNode) { const n = this.dragNode; n.fixed = false; this.dragNode = null; this.onSelect(n.data); this.wake(); return; }
    if (this.panning) { this.panning = false; return; }
    const n = this.pick(this.toWorld(e)); this.onSelect(n ? n.data : null);
  };
  private wheel = (e: WheelEvent) => { e.preventDefault(); const r = this.canvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const z0 = this.zoom; this.zoom = Math.max(0.35, Math.min(2.5, this.zoom * (e.deltaY < 0 ? 1.12 : 0.89))); this.offsetX = mx - ((mx - this.offsetX) / z0) * this.zoom; this.offsetY = my - ((my - this.offsetY) / z0) * this.zoom; this.wake(); };
  private loop = () => {
    const ke = this.step(); this.draw(); this.frame++;
    if (!this.fitted && this.frame > RetroSim.SETTLE_MIN) { this.fit(); this.fitted = true; }
    // ponytail: KE scales with N — settle on per-node energy or 150 nodes never rest.
    if (this.frame > RetroSim.SETTLE_MIN && ke / Math.max(1, this.nodes.length) < RetroSim.SETTLE_KE_PER_NODE) {
      if (this.selChanged) { this.selChanged = false; this.raf = requestAnimationFrame(this.loop); return; }
      this.settled = true; this.raf = 0; return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };
  private fit() {
    if (!this.nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); }
    const bw = maxX - minX, bh = maxY - minY; if (bw <= 0 || bh <= 0) return;
    const pad = 92; const z = Math.max(0.35, Math.min(1.3, Math.min((this.W - pad) / bw, (this.H - pad) / bh)));
    this.zoom = z; this.offsetX = this.W / 2 - ((minX + maxX) / 2) * z; this.offsetY = this.H / 2 - ((minY + maxY) / 2) * z;
  }
  private step(): number {
    const nodes = this.nodes; if (!nodes.length) return 0;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
      const f = (4200 / d2) * 0.5, d = Math.sqrt(d2);
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const e of this.edges) {
      const s = this.nodeIndex.get(e.source), t = this.nodeIndex.get(e.target); if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y, d = Math.max(1, Math.hypot(dx, dy));
      const ideal = 60 + (s.data.type === "evidence" ? 25 : 20);
      const f = (d - ideal) * 0.02;
      s.vx += (dx / d) * f; s.vy += (dy / d) * f; t.vx -= (dx / d) * f; t.vy -= (dy / d) * f;
    }
    const cx = this.W / 2, cy = this.H / 2; let ke = 0;
    for (const n of nodes) {
      if (n.fixed) continue;
      n.vx += (cx - n.x) * 0.01; n.vy += (cy - n.y) * 0.01;
      n.vx *= 0.85; n.vy *= 0.85;
      // ponytail: sleep sub-pixel drift — kills the endless shimmer that made clicks miss.
      if (n.vx * n.vx + n.vy * n.vy < 1e-4) { n.vx = 0; n.vy = 0; }
      else { n.x += n.vx; n.y += n.vy; }
      n.x = Math.max(20, Math.min(this.W - 20, n.x)); n.y = Math.max(20, Math.min(this.H - 20, n.y));
      ke += n.vx * n.vx + n.vy * n.vy;
    }
    return ke;
  }
  private radius(n: PNode): number {
    if (n.data.type === "evidence") return 4;
    if (n.id === this.centralId) return 18;
    return 8 + ((n.data.confidence ?? 0.5) * 8);
  }
  private trunc(s: string, max: number): string { const t = String(s || ""); return t.length > max ? t.slice(0, max - 1) + "…" : t; }
  private draw() {
    const { ctx, W, H, dpr, offsetX, offsetY, zoom } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fdf8e8"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(zoom, zoom);
    const hov = this.hover?.id; const cluster = hov ? new Set([hov]) : null;
    if (cluster) for (const e of this.edges) if (e.source === hov || e.target === hov) { cluster.add(e.source); cluster.add(e.target); }
    for (const e of this.edges) {
      const s = this.nodeIndex.get(e.source), t = this.nodeIndex.get(e.target); if (!s || !t) continue;
      const sup = e.relationship === "supports";
      const inC = cluster ? cluster.has(e.source) && cluster.has(e.target) : null;
      ctx.save(); ctx.beginPath(); ctx.moveTo(s.x, s.y);
      const ang = Math.atan2(t.y - s.y, t.x - s.x);
      const tr = this.radius(t) + 6; const ax = t.x - Math.cos(ang) * tr, ay = t.y - Math.sin(ang) * tr;
      ctx.lineTo(ax, ay);
      ctx.globalAlpha = cluster ? (inC ? 0.9 : 0.14) : 0.68;
      ctx.strokeStyle = sup ? "#5a9a3a" : "#a33"; ctx.lineWidth = sup ? 1.6 : 1.3;
      if (!sup) ctx.setLineDash([6, 4]);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.translate(ax, ay); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3.6); ctx.lineTo(-3, 3.6); ctx.closePath();
      ctx.globalAlpha = cluster ? (inC ? 0.9 : 0.3) : 0.85; ctx.fillStyle = sup ? "#2e7d32" : "#a33"; ctx.fill();
      ctx.restore();
    }
    for (const n of this.nodes) {
      const ev = n.data.type === "evidence";
      const fill = ev ? "#9aa0a8" : n.id === this.centralId ? "#0a2a5e" : "#ffffff";
      const ring = retroStatusColor(n.data.status);
      const inC = cluster ? cluster.has(n.id) : true;
      ctx.globalAlpha = ev ? 0.75 * (cluster ? (inC ? 1 : 0.25) : 1) : 0.97 * (cluster ? (inC ? 1 : 0.25) : 1);
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(n.x, n.y, this.radius(n), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = cluster ? (inC ? 1 : 0.25) : 1;
      ctx.strokeStyle = ring; ctx.lineWidth = n.id === this.centralId ? 3 : ev ? 1 : 2.2; ctx.stroke();
      if (this.selectedId === n.id) { ctx.strokeStyle = "#0a2a5e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, this.radius(n) + 5, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const n of this.nodes) {
      if (n.data.type === "evidence") continue;
      const r = this.radius(n); const isH = this.hover?.id === n.id;
      const inC = cluster ? cluster.has(n.id) : true;
      ctx.font = `600 ${(isH ? 12 : 11) / zoom}px Verdana, sans-serif`;
      const label = this.trunc((n.data as any).short_label || n.data.label || n.id, isH ? 44 : 30);
      // ponytail: paper halo so navy labels stay legible on cream.
      ctx.globalAlpha = (inC ? 1 : 0.15) * 0.9; ctx.strokeStyle = "rgba(253,248,232,0.95)"; ctx.lineWidth = 3 / zoom;
      ctx.strokeText(label, n.x, n.y + r + 6 / zoom);
      ctx.globalAlpha = (inC ? 1 : 0.15) * 0.95; ctx.fillStyle = n.id === this.centralId ? "#0a2a5e" : "#1a1a1a";
      ctx.fillText(label, n.x, n.y + r + 6 / zoom);
    }
    ctx.restore();
  }
}

export default function ClaimExplorerCanvas({ nodes, edges, selectedId, centralId, frozen = false, height = 460, onSelect }: { nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[]; selectedId: string | null; centralId: string | null; frozen?: boolean; height?: number; onSelect: (n: ClaimGraphNode | null) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sim = useRef<RetroSim | null>(null);
  const cb = useRef(onSelect); cb.current = onSelect;
  useEffect(() => {
    if (!ref.current || nodes.length === 0) return;
    const s = new RetroSim(ref.current, nodes, edges, (n) => cb.current(n), selectedId, centralId);
    sim.current = s;
    return () => { s.destroy(); sim.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, centralId]);
  useEffect(() => { sim.current?.setSelected(selectedId); }, [selectedId]);
  useEffect(() => { sim.current?.setFrozen(frozen); }, [frozen]);
  return (
    <div className="relative w-full overflow-hidden select-none" style={{ height, background: "#fdf8e8", borderStyle: "inset", borderWidth: 3, borderColor: "#a09060 #fff9e5 #fff9e5 #a09060", boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.2)" }}>
      <canvas ref={ref} className="absolute inset-0 w-full h-full block touch-none cursor-grab" />
      <div className="absolute left-2 top-2 px-2 py-1 bg-[#0a2a5e] text-white text-[10px] border border-black pointer-events-none">DRAG CANVAS • DRAG NODE • SCROLL ZOOM • CLICK CLAIM</div>
      <div className="absolute right-2 top-2 flex gap-2 text-[9px] pointer-events-none">
        {[["#2e7d32","Verified"],["#5a9a3a","Supported"],["#b7791f","Disputed"],["#a33a3a","Contradicted"]].map(([c,l])=><span key={l} className="flex items-center gap-1 bg-[#fdf8e8]/85 px-1"><span className="w-2.5 h-2.5 rounded-full inline-block border border-black" style={{ background:c }}/>{l}</span>)}
      </div>
    </div>
  );
}
