"use client";

interface KeyFact {
  id: string;
  text: string;
  status?: string;
  derived_confidence?: number;
}

// File box — the generic stand-in for Wikipedia's infobox. Rows are the
// article's top resolved claims (supported first), ranked server-side in
// the epistemic composite. Renders nothing when there are no facts.
export default function KeyFactsBox({ facts }: { facts: KeyFact[] }) {
  if (!facts || facts.length === 0) return null;
  return (
    <section
      className="my-6 rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--border, #e5e5e5)", background: "var(--surface-elevated, #fff)" }}
      aria-label="Key facts"
    >
      <div
        className="px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase"
        style={{
          color: "var(--muted)",
          borderBottom: "1px solid var(--border-light, #eee)",
          letterSpacing: "0.08em",
        }}
      >
        Key facts
      </div>
      <ul className="px-4 py-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2" style={{ listStyle: "none", margin: 0 }}>
        {facts.map((f) => (
          <li key={f.id} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
            <span aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>◆</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
