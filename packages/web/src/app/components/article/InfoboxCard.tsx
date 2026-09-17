"use client";

interface FactItem {
  label: string;
  value: string;
}

interface InfoboxCardProps {
  title?: string;
  facts?: FactItem[];
}

// ponytail: ruled factfile, not a gradient plate — the journal's existing
// `.factfile` primitive carries it with zero new CSS.
export default function InfoboxCard({ title, facts = [] }: InfoboxCardProps) {
  if (!facts || facts.length === 0) return null;

  return (
    <section className="my-8" aria-label={title || "Key facts"}>
      {title && (
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle mb-2">
          {title}
        </div>
      )}
      <dl className="factfile">
        {facts.map((f, i) => (
          <div key={i} className="factfile-row">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
