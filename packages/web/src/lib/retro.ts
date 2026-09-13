"use client";
// ponytail: single retro helper — flag, colors, generalized adapter. No new deps.
// ponytail: retro is now the platform default — escape hatch only.
export const IS_RETRO = process.env.NEXT_PUBLIC_RETRO !== "false";

export function retroStatusColor(s?: string): string {
  if (s === "verified") return "#2e7d32";
  if (s === "supported") return "#5a9a3a";
  if (s === "disputed") return "#b7791f";
  return "#a33a3a";
}

export interface AtlasNode { id: string; label: string; short: string; detail: string; citation: string; strength: string; status: string; conf: number; kind: "central" | "support" | "contradict"; x: number; y: number; vx: number; vy: number; }
export interface AtlasEdge { source: string; target: string; type: "supports" | "contradicts"; }

// ponytail: live-safe helpers — word-boundary truncation, contradiction rank.
export function smartShort(s: string, max = 42): string {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 12 ? cut.slice(0, sp) : cut) + "…";
}
export function domainOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return String(u || "").slice(0, 40); }
}
export function contradictionOf(n: { contradiction_level?: number; confidence_vector?: Record<string, number>; confidence?: number }): number {
  if (typeof (n as any)?.contradiction_level === "number") return (n as any).contradiction_level;
  const v = n?.confidence_vector?.contradiction_level;
  return typeof v === "number" ? v : 0;
}

// ponytail: map → graph derivation — same payload, three scopes. Pure, no fetch.
export function toSubgraph(
  nodes: Array<{ id: string; type?: string; article_slug?: string }>,
  edges: Array<{ source: string; target: string }>,
  scope: { territory?: string | null; focusId?: string | null }
): { nodes: typeof nodes; edges: typeof edges } {
  const { territory = null, focusId = null } = scope;
  let claims = nodes.filter((n) => n.type !== "evidence");
  if (territory) claims = claims.filter((c) => (c.article_slug ?? "unfiled") === territory);
  let keep = new Set(claims.map((c) => c.id));
  if (focusId && keep.has(focusId)) {
    const hop = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId && keep.has(e.target)) hop.add(e.target);
      if (e.target === focusId) hop.add(e.source);
    }
    keep = hop;
  }
  for (const e of edges) if (keep.has(e.target) && !keep.has(e.source)) keep.add(e.source);
  const out = nodes.filter((n) => keep.has(n.id));
  const ids = new Set(out.map((n) => n.id));
  return { nodes: out, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

// Generalized: live ClaimGraphNode/Edge + optional claim text map -> Spinosaurus-shaped nodes.
export function toAtlas(
  nodes: Array<{ id: string; label?: string; status?: string; confidence?: number; type?: string }>,
  edges: Array<{ source: string; target: string; relationship?: string; type?: string }>,
  texts?: Record<string, { text?: string; citation?: string }>
): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const inbound = new Map<string, number>();
  for (const e of edges) inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
  // ponytail: most-contested claim wins globally; max inbound per-article. No "central" id assumption.
  let central = nodes[0]?.id ?? "central";
  let best = -Infinity;
  for (const n of nodes as any[]) {
    if (n.type !== "claim" && (n as any).type) continue;
    const score = contradictionOf(n as any) * 10 + (inbound.get(n.id) ?? 0);
    if (score > best) { best = score; central = n.id; }
  }
  const spots: Array<[number, number]> = [[260,220],[90,80],[420,70],[100,380],[430,360],[260,60],[60,220],[460,200],[140,300],[380,290]];
  const an = nodes.map((n, i) => {
    const t = texts?.[n.id];
    const ev0 = n as any;
    const raw = ev0.short_label || n.label || n.id;
    const label = raw;
    const isEvidence = (n as any).type === "evidence";
    const rel = edges.find((e) => e.source === n.id && e.target === central)?.relationship;
    const kind: AtlasNode["kind"] = n.id === central ? "central" : rel === "contradicts" ? "contradict" : "support";
    const [x, y] = spots[i % spots.length];
    const ev = n as any;
    const cite = t?.citation ?? (isEvidence ? domainOf(ev.label) : (ev.article_title ? `${ev.article_title} • ${ev.article_slug ?? ""}` : label));
    return { id: n.id, label, short: smartShort(label, isEvidence ? 28 : 26), detail: t?.text ?? label, citation: cite, strength: n.status ?? "—", status: n.status ?? "supported", conf: n.confidence ?? 0.5, kind, x, y, vx: 0, vy: 0 } as AtlasNode;
  });
  const ae: AtlasEdge[] = edges.map((e) => ({ source: e.source, target: e.target, type: e.relationship === "contradicts" || e.type === "contradicts" ? "contradicts" : "supports" }));
  return { nodes: an, edges: ae };
}

// Exact Spinosaurus mock (frontend mock only) — matches reference Hp/Ba.
export const MOCK_SPINO_NODES = [
  { id: "central", label: "Spinosaurus was a specialized aquatic predator", status: "disputed", confidence: 0.58, type: "claim" },
  { id: "tail", label: "Paddle-like tail fin (2020)", status: "verified", confidence: 0.89, type: "claim" },
  { id: "dense", label: "Dense bones for buoyancy control", status: "supported", confidence: 0.74, type: "claim" },
  { id: "nostril", label: "Retracted nares for diving", status: "disputed", confidence: 0.42, type: "claim" },
  { id: "isotope", label: "Isotopic evidence: aquatic diet", status: "supported", confidence: 0.68, type: "claim" },
  { id: "snout", label: "Crocodile-like snout for fishing", status: "verified", confidence: 0.92, type: "claim" },
  { id: "legs", label: "Hind limbs too powerful for fully aquatic life", status: "contradicted", confidence: 0.71, type: "claim" },
  { id: "saildrag", label: "Dorsal sail would create enormous drag", status: "contradicted", confidence: 0.55, type: "claim" },
  { id: "swim", label: "Insufficient swimming biomechanics", status: "contradicted", confidence: 0.66, type: "claim" },
  { id: "floodplain", label: "Fossils in floodplain, not marine deposits", status: "supported", confidence: 0.77, type: "claim" },
];
export const MOCK_SPINO_EDGES = [
  { source: "tail", target: "central", type: "evidence" as const, relationship: "supports" },
  { source: "dense", target: "central", type: "evidence" as const, relationship: "supports" },
  { source: "nostril", target: "central", type: "evidence" as const, relationship: "supports" },
  { source: "isotope", target: "central", type: "evidence" as const, relationship: "supports" },
  { source: "snout", target: "central", type: "evidence" as const, relationship: "supports" },
  { source: "legs", target: "central", type: "evidence" as const, relationship: "contradicts" },
  { source: "saildrag", target: "central", type: "evidence" as const, relationship: "contradicts" },
  { source: "swim", target: "central", type: "evidence" as const, relationship: "contradicts" },
  { source: "floodplain", target: "central", type: "evidence" as const, relationship: "contradicts" },
];
export const MOCK_SPINO_TEXTS: Record<string, { text: string; citation: string }> = {
  central: { text: "The core claim: Spinosaurus spent most of its life in water, hunting like a crocodile or otter. Proposed by Ibrahim et al. 2014 and expanded in 2020.", citation: "Ibrahim et al. 2014 Science; 2020 Nature" },
  tail: { text: "Tall neural spines and chevrons forming a vertical fin. CT scans show lateral undulation.", citation: "Ibrahim et al. 2020 Nature 586: 244-248" },
  dense: { text: "Femur and ribs show pachyostosis like hippos and penguins — ballast for diving.", citation: "Fabbri et al. 2022 Nature" },
  nostril: { text: "Nares placed further back, hypothesized for breathing while submerged.", citation: "Arden et al. 2018; Hone 2021" },
  isotope: { text: "Oxygen isotopes match semi-aquatic animals.", citation: "Amiot et al. 2010 Geology" },
  snout: { text: "Elongate rostrum, conical teeth, sensory pits for detecting fish.", citation: "Rayfield et al. 2007" },
  legs: { text: "Robust femur indicates strong bipedal capability; quadruped claim was flawed.", citation: "Hone & Holtz 2021" },
  saildrag: { text: "1.65m sail increases drag; unstable in currents.", citation: "Bailey 1997; Gimsa 2016" },
  swim: { text: "Tail thrust insufficient to overcome drag; legs not paddles.", citation: "Hone & Holtz 2021; Sereno 2022" },
  floodplain: { text: "Kem Kem fossils in braided rivers with terrestrial fauna.", citation: "Ibrahim 2014 vs Meade 2024" },
};
