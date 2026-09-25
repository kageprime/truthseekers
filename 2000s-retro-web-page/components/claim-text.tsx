"use client";

// ponytail: minimal anchor parser — [claim:id] becomes a chip scrolling to
// #claims. Unknown ids render as plain text, never a dead link.
const ANCHOR_RE = /\[claim:([0-9a-fA-F-]+)\]/g;

export function ClaimText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  ANCHOR_RE.lastIndex = 0;
  while ((m = ANCHOR_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const id = m[1];
    parts.push(
      <a
        key={key++}
        href="#claims"
        data-claim={id}
        title={`Claim ${id.slice(0, 8)}`}
        className="mx-1 inline-block border border-coral px-1 font-mono text-[0.65em] uppercase text-coral hover:bg-coral hover:text-ink"
      >
        ◈{id.slice(0, 8)}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
