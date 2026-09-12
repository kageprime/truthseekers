"use client";

import type { Article } from "@encarta/core";

// File box — the taxonomy table of the plate. Every row is drawn from the
// article record itself; nothing is invented for symmetry. Renders nothing
// when the record carries no fileable facts.
export default function FactFile({ article }: { article: Article }) {
  const rows: Array<[string, string]> = [];
  const meta: any = article.metadata ?? {};
  if (meta.status) rows.push(["Status", String(meta.status)]);
  if (meta.version != null) rows.push(["Revision", String(meta.version)]);
  if (meta.updated) {
    const d = new Date(meta.updated);
    if (!Number.isNaN(d.getTime())) {
      rows.push(["Updated", d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })]);
    }
  }
  if (article.categories && article.categories.length > 0) {
    rows.push(["Filed under", article.categories.slice(0, 3).join(" · ")]);
  }
  if (meta.generatedBy) rows.push(["Set by", String(meta.generatedBy).slice(0, 24)]);
  const conf = (article as any)?.derived_confidence;
  if (typeof conf === "number") rows.push(["Confidence", conf.toFixed(2)]);

  if (rows.length === 0) return null;

  return (
    <dl className="factfile" aria-label="Article file">
      {rows.map(([k, v]) => (
        <div key={k} className="factfile-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
