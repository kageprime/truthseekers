"use client";

// ConfidenceRadar renders a 6-axis SVG radar chart of a claim's confidence
// vector: evidence_strength, corroboration_index, source_diversity, recency,
// contradiction_level, bias_risk. Zero dependencies — a hand-rolled polygon.

const AXES = [
  "evidence_strength",
  "corroboration_index",
  "source_diversity",
  "recency",
  "contradiction_level",
  "bias_risk",
] as const;

const SIZE = 120;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 14;

function polar(angle: number, r: number): [number, number] {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

export default function ConfidenceRadar({ vector, size = 120 }: { vector?: Record<string, number> | null | undefined; size?: number }) {
  const v = vector || {};
  const ground = Math.round(size * (SIZE / 120));

  // Axis start angles, starting top (-90deg), clockwise.
  const angles = AXES.map((_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / AXES.length);

  const ring = (frac: number) =>
    angles.map((a) => polar(a, R * frac).map((n) => n * (size / SIZE)).join(",")).join(" ");

  const val = (axis: string) => {
    const n = Number(v[axis]);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  };

  const dataPoly = angles
    .map((a, i) => {
      const rr = R * val(AXES[i]);
      const [x, y] = polar(a, rr);
      return `${x * (size / SIZE)},${y * (size / SIZE)}`;
    })
    .join(" ");

  const stroke = 1.5 * (size / SIZE);

  return (
    <svg width={ground} height={ground} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="Confidence vector radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--border, #e5e5e5)" strokeWidth={0.75 * (size / SIZE)} />
      ))}
      {angles.map((a, i) => {
        const [x, y] = polar(a, R);
        const [cx0, cy0] = polar(a, R * 1.12);
        return (
          <g key={AXES[i]}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border, #e5e5e5)" strokeWidth={0.75 * (size / SIZE)} />
            <text
              x={cx0 * (size / SIZE)}
              y={cy0 * (size / SIZE)}
              fontSize={7.5 * (size / SIZE)}
              fill="var(--muted, #777)"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ textTransform: "capitalize" }}
            >
              {shortLabel(AXES[i])}
            </text>
          </g>
        );
      })}
      <polygon points={dataPoly} fill="rgba(184,122,46,0.18)" stroke="var(--gold, #b87a2e)" strokeWidth={stroke} strokeLinejoin="round" />
      {angles.map((a, i) => {
        const rr = R * val(AXES[i]);
        const [x, y] = polar(a, rr);
        return <circle key={i} cx={x * (size / SIZE)} cy={y * (size / SIZE)} r={2 * (size / SIZE)} fill="var(--gold, #b87a2e)" />;
      })}
    </svg>
  );
}

function shortLabel(axis: string): string {
  const map: Record<string, string> = {
    evidence_strength: "evidence",
    corroboration_index: "corrob.",
    source_diversity: "diversity",
    recency: "recency",
    contradiction_level: "contest",
    bias_risk: "bias",
  };
  return map[axis] || axis.replace(/_/g, " ");
}
