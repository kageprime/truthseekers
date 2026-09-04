"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "./ProcessViewer";

interface EpisodeFeedProps {
  events: AgentEvent[];
}

const META: Record<string, { icon: string; tone: string; label: string }> = {
  source_found:      { icon: "◉", tone: "var(--accent)",  label: "Source found" },
  claim_discovered:  { icon: "◆", tone: "var(--accent)",  label: "Claim extracted" },
  evidence_mapped:   { icon: "↔", tone: "var(--green)",   label: "Evidence mapped" },
  gap_detected:      { icon: "◌", tone: "var(--oxblood)", label: "Open question" },
  claim_scrutinized: { icon: "◈", tone: "var(--gold)",    label: "Scrutiny" },
  claim_resolved:    { icon: "✓", tone: "var(--green)",   label: "Resolution" },
  article_section:   { icon: "▤", tone: "var(--ink)",     label: "Section written" },
};

function summarize(ev: AgentEvent): string {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  switch (ev.type) {
    case "source_found":
      return String(d.title ?? d.url ?? d.id ?? "source");
    case "claim_discovered":
      return String(d.text ?? d.id ?? "");
    case "evidence_mapped": {
      const sup = Number(d.supporting ?? 0);
      const con = Number(d.contradicting ?? 0);
      return `Claim ${d.claim_id} — ${sup} supporting, ${con} contradicting`;
    }
    case "gap_detected":
      return String(d.artifact ?? d.cause ?? d.id ?? "");
    case "claim_scrutinized": {
      const r = Number(d.risk ?? 0);
      return `Claim ${d.claim_id} — risk ${Math.round(r * 100)}%`;
    }
    case "claim_resolved": {
      const c = Number(d.confidence ?? 0);
      return `${d.id} — ${d.status} (${Math.round(c * 100)}% confidence)`;
    }
    case "article_section":
      return String(d.title ?? d.id ?? "");
    default:
      return ev.type;
  }
}

function relativeAge(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default function EpisodeFeed({ events }: EpisodeFeedProps) {
  const [now, setNow] = useState(() => Date.now());
  const tailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (events.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [events.length > 0]);

  if (events.length === 0) {
    return (
      <div className="mt-4 text-[10px] uppercase tracking-wider text-center" style={{ color: "var(--subtle)" }}>
        Awaiting first signal…
      </div>
    );
  }

  const counts: Record<string, number> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;

  return (
    <div className="mt-4 rounded border" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: "var(--border-light)" }}
      >
        <span className="relative flex w-2 h-2 shrink-0" aria-hidden>
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-70 animate-ping"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="relative inline-flex w-2 h-2 rounded-full"
            style={{ background: "var(--accent)" }}
          />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink)" }}>
          Live episode
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-[9px] tabular-nums hidden sm:inline" style={{ color: "var(--subtle)" }}>
          {Object.entries(counts).slice(0, 3).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(" · ")}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto px-2 py-2 space-y-1.5" style={{ scrollBehavior: "smooth" }}>
        {[...events].reverse().map((ev, i) => {
          const meta = META[ev.type] ?? { icon: "•", tone: "var(--muted)", label: ev.type };
          return (
            <div
              key={`${ev.timestamp}-${i}-${ev.type}`}
              className="activity-card flex items-start gap-2 px-2.5 py-1.5 rounded"
              style={{ background: "color-mix(in srgb, var(--surface-elevated) 70%, transparent)" }}
            >
              <span
                className="shrink-0 w-4 text-center font-bold text-sm leading-none mt-0.5"
                style={{ color: meta.tone }}
                aria-hidden
              >
                {meta.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider truncate"
                    style={{ color: meta.tone }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[9px] tabular-nums shrink-0" style={{ color: "var(--subtle)" }}>
                    {relativeAge(ev.timestamp, now)}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--ink)" }}>
                  {summarize(ev)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={tailRef} />
      </div>
    </div>
  );
}
