"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { BlockItem } from "./BlockRenderer";
import type { Block } from "@encarta/core";

// Figure types become draggable objects; everything else stays in the prose flow.
const FIGURE_TYPES = new Set(["image", "gallery", "diagram", "map_2d", "map_3d", "timeline", "table", "video"]);

interface FlowNode {
  key: string;
  block: Block;
  figure: boolean;
}

type Side = "left" | "right";
type Size = "s" | "m" | "l";

const SIZE_LABEL: Record<Size, string> = { s: "S", m: "M", l: "L" };
const NEXT_SIZE: Record<Size, Size> = { s: "m", m: "l", l: "s" };

export default function MagazineBody({
  blocks,
  claimsIndex,
  dissentMode,
}: {
  blocks: Block[];
  claimsIndex?: Record<string, { status?: string; derived_confidence?: number }>;
  dissentMode?: boolean;
}) {
  const nodes = useMemo<FlowNode[]>(
    () =>
      (blocks ?? []).map((b, i) => ({
        key: b.id ?? `n-${i}`,
        block: b,
        figure: FIGURE_TYPES.has(b.type) || b.type === "pullquote",
      })),
    [blocks]
  );
  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  // Null = natural order. Dragging a figure writes an explicit order.
  const [order, setOrder] = useState<string[] | null>(null);
  const seq = useMemo(() => {
    const keys = order ?? nodes.map((n) => n.key);
    return keys.map((k) => byKey.get(k)).filter((n): n is FlowNode => !!n);
  }, [nodes, byKey, order]);

  // Per-object overrides; defaults alternate sides at medium size.
  const [layout, setLayout] = useState<Record<string, { side: Side; size: Size }>>({});
  const figOrdinal = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const n of seq) if (n.figure) m.set(n.key, i++);
    return m;
  }, [seq]);
  const placement = (key: string): { side: Side; size: Size } =>
    layout[key] ?? { side: (figOrdinal.get(key) ?? 0) % 2 === 0 ? "right" : "left", size: "m" };

  // Drag state — pointer drag from the grip, drop anchors do the rest.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragKeyRef = useRef<string | null>(null);

  const onGripDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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
      setOrder((prev) => {
        const base = prev ?? nodes.map((n) => n.key);
        const without = base.filter((k) => k !== key);
        const at = Math.max(0, Math.min(dropIndex > base.indexOf(key) && base.includes(key) ? dropIndex - 1 : dropIndex, without.length));
        return [...without.slice(0, at), key, ...without.slice(at)];
      });
    }
    setDropIndex(null);
  };

  const cycleSize = (key: string) =>
    setLayout((prev) => {
      const cur = prev[key] ?? placement(key);
      return { ...prev, [key]: { ...cur, size: NEXT_SIZE[cur.size] } };
    });

  if (seq.length === 0) {
    return <div className="text-sm" style={{ color: "var(--subtle)" }}>No content yet.</div>;
  }

  const firstTextKey = seq.find((n) => !n.figure && n.block.type === "text")?.key;

  return (
    <div className="mag-flow stagger-children" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {seq.map((n, i) => (
        <Fragment key={n.key}>
          <div data-mag-anchor={i} className={"mag-anchor" + (dragKey != null && dropIndex === i ? " mag-anchor-hot" : "") + (dragKey != null ? " mag-anchor-live" : "")} />
          {n.figure ? (
            <FloatObject
              nodeKey={n.key}
              block={n.block}
              side={placement(n.key).side}
              size={placement(n.key).size}
              claimsIndex={claimsIndex}
              dissentMode={dissentMode}
              dragging={dragKey === n.key}
              onGripDown={onGripDown}
              onSize={() => cycleSize(n.key)}
            />
          ) : (
            <div className="mag-prose">
              <BlockItem block={n.block} claimsIndex={claimsIndex} dissentMode={dissentMode} dropCap={n.key === firstTextKey} />
            </div>
          )}
        </Fragment>
      ))}
      <div data-mag-anchor={seq.length} className={"mag-anchor mag-anchor-end" + (dragKey != null && dropIndex === seq.length ? " mag-anchor-hot" : "") + (dragKey != null ? " mag-anchor-live" : "")} />
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[2, 8].map((x) =>
        [2, 8, 14].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />)
      )}
    </svg>
  );
}

function FloatObject({
  nodeKey,
  block,
  side,
  size,
  claimsIndex,
  dissentMode,
  dragging,
  onGripDown,
  onSize,
}: {
  nodeKey: string;
  block: Block;
  side: Side;
  size: Size;
  claimsIndex?: Record<string, { status?: string; derived_confidence?: number }>;
  dissentMode?: boolean;
  dragging: boolean;
  onGripDown: (e: React.PointerEvent, key: string) => void;
  onSize: () => void;
}) {
  const pull = block.type === "pullquote";
  return (
    <figure
      className={`mag-float mag-${side} mag-size-${size}${pull ? " mag-pull" : ""}${dragging ? " mag-dragging" : ""}`}
      data-fig={nodeKey}
    >
      <div className="mag-tools" aria-hidden={false}>
        <button
          className="mag-grip"
          onPointerDown={(e) => onGripDown(e, nodeKey)}
          aria-label="Drag to reposition in the article"
          title="Drag to reposition"
        >
          <GripIcon />
        </button>
        <button className="mag-zoom" onClick={onSize} aria-label="Cycle object size" title="Cycle size S / M / L">
          {SIZE_LABEL[size]}
        </button>
      </div>
      <BlockItem block={block} claimsIndex={claimsIndex} dissentMode={dissentMode} />
    </figure>
  );
}
