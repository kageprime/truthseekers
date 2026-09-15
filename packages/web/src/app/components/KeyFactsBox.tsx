"use client";

import { useState } from "react";

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
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  if (!facts || facts.length === 0) return null;

  return (
    <section
      className="my-4 sm:my-6 rounded-lg border overflow-hidden transition-all"
      style={{ borderColor: "var(--border, #e5e5e5)", background: "var(--surface-elevated, #fff)" }}
      aria-label="Key facts"
    >
      <button
        onClick={() => setIsOpenMobile((o) => !o)}
        className="w-full px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase flex items-center justify-between cursor-pointer sm:cursor-default text-left"
        style={{
          color: "var(--muted)",
          borderBottom: "1px solid var(--border-light, #eee)",
          letterSpacing: "0.08em",
        }}
      >
        <span>Key facts ({facts.length})</span>
        <span className="sm:hidden text-xs font-normal text-accent">
          {isOpenMobile ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      <ul
        className={`px-4 py-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 ${
          isOpenMobile ? "block" : "hidden sm:grid"
        }`}
        style={{ listStyle: "none", margin: 0 }}
      >
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
