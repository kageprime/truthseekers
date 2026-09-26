"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BlockItem } from "./BlockRenderer";
import type { Block } from "@encarta/core";

// ponytail: hoistable floats wrap text; data-viz stays full-measure uncropped.
const HOISTABLE = new Set(["image", "video", "pullquote"]);
const FLOATABLE = new Set(["image", "video", "pullquote"]);

interface FlowNode {
  key: string;
  block: Block;
  figure: boolean;
}

type Side = "left" | "right";
type Size = "s" | "m" | "l";

const SIZE_LABEL: Record<Size, string> = { s: "S", m: "M", l: "L" };
const NEXT_SIZE: Record<Size, Size> = { s: "m", m: "l", l: "s" };

// Hoist each hoistable figure to directly after its section heading
// (Wikipedia thumbnail behavior) — floats need following text to wrap.
function buildFlow(blocks: Block[]): FlowNode[] {
  const nodes: FlowNode[] = (blocks ?? []).map((b, i) => ({
    key: (b as any).id ?? `n-${i}`,
    block: b,
    figure: FLOATABLE.has(b.type),
  }));
  const out: FlowNode[] = [];
  let sectionStart = 0; // index in `out` just after current heading
  let hoisted = 0;
  for (const n of nodes) {
    if (n.block.type === "heading") {
      out.push(n);
      sectionStart = out.length;
      hoisted = 0;
    } else if (HOISTABLE.has(n.block.type) && out.length > 0) {
      out.splice(sectionStart + hoisted, 0, n);
      hoisted++;
    } else {
      out.push(n);
    }
  }
  // No heading at all: keep natural order.
  return out.length ? out : nodes;
}

function moveKey(base: string[], key: string, delta: number): string[] {
  const from = base.indexOf(key);
  if (from < 0) return base;
  const to = Math.max(0, Math.min(base.length - 1, from + delta));
  if (to === from) return base;
  const without = base.filter((k) => k !== key);
  return [...without.slice(0, to), key, ...without.slice(to)];
}

export default function MagazineFlow({
  blocks,
  slug,
  claimsIndex,
  dissentMode,
  activeClaimId,
  onClaimSelect,
  citeNumbers,
}: {
  blocks: Block[];
  slug?: string;
  claimsIndex?: Record<string, { status?: string; derived_confidence?: number; text?: string }>;
  dissentMode?: boolean;
  activeClaimId?: string | null;
  onClaimSelect?: (id: string) => void;
  citeNumbers?: Record<string, number> | null;
}) {
  const natural = useMemo(() => buildFlow(blocks), [blocks]);
  const byKey = useMemo(() => new Map(natural.map((n) => [n.key, n])), [natural]);
  const storeKey = slug ? `truthseekers_figlayout:${slug}` : null;

  const [order, setOrder] = useState<string[] | null>(null);
  const [layout, setLayout] = useState<Record<string, { side: Side; size: Size }>>({});
  const [hydrated, setHydrated] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    if (!storeKey) return;
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.order)) setOrder(saved.order);
        if (saved.layout && typeof saved.layout === "object") setLayout(saved.layout);
      }
    } catch {}
    setHydrated(true);
  }, [storeKey]);

  useEffect(() => {
    if (!hydrated || !storeKey) return;
    try {
      if (!order && Object.keys(layout).length === 0) localStorage.removeItem(storeKey);
      else localStorage.setItem(storeKey, JSON.stringify({ order, layout }));
    } catch {}
  }, [order, layout, hydrated, storeKey]);

  const seq = useMemo(() => {
    const keys = order ?? natural.map((n) => n.key);
    const mapped = keys.map((k) => byKey.get(k)).filter((n): n is FlowNode => !!n);
    // New blocks (pipeline refresh) append naturally.
    for (const n of natural) if (!keys.includes(n.key)) mapped.push(n);
    return mapped;
  }, [natural, byKey, order]);

  const figOrdinal = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const n of seq) if (n.figure) m.set(n.key, i++);
    return m;
  }, [seq]);
  const placement = (key: string): { side: Side; size: Size } =>
    layout[key] ?? { side: (figOrdinal.get(key) ?? 0) % 2 === 0 ? "right" : "left", size: "m" };

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const [liftKey, setLiftKey] = useState<string | null>(null);
  const liftBackup = useRef<string[] | null>(null);

  const applyOrder = (key: string, at: number) => {
    setOrder((prev) => {
      const base = prev ?? natural.map((n) => n.key);
      const without = base.filter((k) => k !== key);
      const clamped = Math.max(0, Math.min(at, without.length));
      return [...without.slice(0, clamped), key, ...without.slice(clamped)];
    });
  };

  const onGripDown = (e: React.PointerEvent, key: string) => {
    if ((e.target as HTMLElement).closest("button")?.classList.contains("mag-zoom")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragKeyRef.current = key;
    setDragKey(key);
    setDropIndex(null);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragKeyRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-mag-anchor]");
    setDropIndex(el ? Number((el as HTMLElement).dataset.magAnchor) : null);
  };
  const endDrag = () => {
    const key = dragKeyRef.current;
    dragKeyRef.current = null;
    setDragKey(null);
    if (key != null && dropIndex != null) {
      const base = order ?? natural.map((n) => n.key);
      const at = dropIndex > base.indexOf(key) ? dropIndex - 1 : dropIndex;
      applyOrder(key, Math.max(0, Math.min(at, base.length)));
      setAnnounce(`Figure moved to position ${at + 1}`);
    }
    setDropIndex(null);
  };

  const onGripKey = (e: React.KeyboardEvent, key: string) => {
    const base = order ?? natural.map((n) => n.key);
    const idx = base.indexOf(key);
    if (e.key === "Enter") {
      e.preventDefault();
      if (liftKey === key) {
        setLiftKey(null);
        liftBackup.current = null;
        setAnnounce(`Figure dropped at position ${idx + 1}`);
      } else {
        liftBackup.current = base;
        setLiftKey(key);
        setAnnounce(`Figure lifted. Use arrow keys to move, Enter to drop, Escape to cancel.`);
      }
    } else if (e.key === "Escape") {
      if (liftKey) {
        e.preventDefault();
        if (liftBackup.current) setOrder(liftBackup.current);
        setLiftKey(null);
        liftBackup.current = null;
        setAnnounce("Move cancelled");
      }
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (liftKey === key || liftKey == null)) {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const next = moveKey(base, key, delta);
      setOrder(next);
      setAnnounce(`Figure ${next.indexOf(key) + 1} of ${next.length}`);
    }
  };

  const cycleSize = (key: string) =>
    setLayout((prev) => {
      const cur = prev[key] ?? placement(key);
      return { ...prev, [key]: { ...cur, size: NEXT_SIZE[cur.size] } };
    });

  const dirty = order != null || Object.keys(layout).length > 0;
  const reset = () => {
    setOrder(null);
    setLayout({});
    setLiftKey(null);
    setAnnounce("Layout reset");
  };

  if (seq.length === 0) {
    return <div className="text-sm" style={{ color: "var(--subtle)" }}>No content yet.</div>;
  }

  const firstTextKey = seq.find((n) => !n.figure && n.block.type === "text")?.key;

  return (
    <div>
      {dirty && (
        <div className="flex justify-end pb-2">
          <button onClick={reset} className="text-xs font-mono underline decoration-rule hover:decoration-gold underline-offset-4" style={{ color: "var(--subtle)" }}>
            Reset layout
          </button>
        </div>
      )}
      <div className="mag-flow stagger-children" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {seq.map((n, i) => (
          <Fragment key={n.key}>
            <div data-mag-anchor={i} tabIndex={liftKey ? 0 : -1} className={"mag-anchor" + (dragKey != null && dropIndex === i ? " mag-anchor-hot" : "") + (dragKey != null || liftKey ? " mag-anchor-live" : "")} />
            {n.figure ? (
              <figure className={`mag-float mag-float-${placement(n.key).side} mag-size-${placement(n.key).size}${n.block.type === "pullquote" ? " mag-pull" : ""}${dragKey === n.key ? " mag-dragging" : ""}`} data-fig={n.key}>
                <div className="mag-tools">
                  <button
                    className="mag-grip"
                    onPointerDown={(e) => onGripDown(e, n.key)}
                    onKeyDown={(e) => onGripKey(e, n.key)}
                    aria-label="Reposition figure. Enter to lift, arrows to move, Enter to drop, Escape to cancel."
                    title="Drag or Enter to reposition"
                  >
                    <GripDots />
                  </button>
                  <button className="mag-zoom" onClick={() => cycleSize(n.key)} aria-label="Cycle figure size S M L" title="Size S / M / L">
                    {SIZE_LABEL[placement(n.key).size]}
                  </button>
                </div>
                <BlockItem block={n.block} claimsIndex={claimsIndex} dissentMode={dissentMode} activeClaimId={activeClaimId} onClaimSelect={onClaimSelect} citeNumbers={citeNumbers} />
              </figure>
            ) : (
              <div className="mag-prose">
                <BlockItem block={n.block} claimsIndex={claimsIndex} dissentMode={dissentMode} dropCap={n.key === firstTextKey} activeClaimId={activeClaimId} onClaimSelect={onClaimSelect} citeNumbers={citeNumbers} />
              </div>
            )}
          </Fragment>
        ))}
        <div data-mag-anchor={seq.length} tabIndex={liftKey ? 0 : -1} className={"mag-anchor mag-anchor-end" + (dragKey != null && dropIndex === seq.length ? " mag-anchor-hot" : "") + (dragKey != null || liftKey ? " mag-anchor-live" : "")} />
      </div>
      <span aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}

function GripDots() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[2, 8].map((x) => [2, 8, 14].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />))}
    </svg>
  );
}
