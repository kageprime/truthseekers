"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchArticleClaims } from "@/lib/api";
import type { Claim } from "@/lib/types";

// ponytail: status → color mapping ported from the old EpistemicGraphWidget,
// restyled for the paper theme.
const STATUS = {
  supported: { dot: "bg-emerald-700", text: "text-emerald-800", label: "Verified" },
  disputed: { dot: "bg-amber-600", text: "text-amber-800", label: "Contested" },
  weak: { dot: "bg-rose-700", text: "text-rose-800", label: "Unverified" },
  unknown: { dot: "bg-rose-700", text: "text-rose-800", label: "Unverified" },
} as Record<string, { dot: string; text: string; label: string }>;

// ponytail: module cache — hovering nine cards must not refetch the same slug.
const cache = new Map<string, Claim[]>();

function styleOf(status: string) {
  return STATUS[status] ?? STATUS.unknown;
}

// Hover/focus a card's claim strip → lazy-load that article's claims into a
// popover with a status distribution bar. Click a claim → opens it as a tab
// on /claims via ?claim=. Clicks never bubble to the parent article link.
export function ClaimHover({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState<Claim[] | null>(cache.get(slug) ?? null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const load = () => {
    setOpen(true);
    if (cache.has(slug)) {
      setClaims(cache.get(slug) ?? []);
      return;
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    fetchArticleClaims(slug, c.signal).then((list) => {
      cache.set(slug, list);
      if (!c.signal.aborted) setClaims(list);
    });
  };

  const counts = (claims ?? []).reduce<Record<string, number>>((m, c) => {
    m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, {});
  const total = claims?.length ?? 0;
  const avg = total
    ? Math.round(claims!.reduce((s, c) => s + (c.derived_confidence ?? 0), 0) / total * 100)
    : 0;
  const order = ["supported", "disputed", "weak", "unknown"].filter((s) => counts[s]);

  const openClaim = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/claims?claim=${encodeURIComponent(id)}`);
  };

  return (
    <span
      className="relative mt-3 block"
      onMouseEnter={load}
      onMouseLeave={() => setOpen(false)}
      onFocus={load}
      onBlur={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={total ? `${total} claims, average confidence ${avg} percent. Activate to inspect.` : "Loading claims…"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (claims) setOpen((o) => !o);
          else load();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            if (claims) setOpen((o) => !o);
            else load();
          }
        }}
        className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase text-muted hover:text-ink"
      >
        {total > 0 ? (
          <>
            <span className="flex -space-x-1">
              {order.map((s) => (
                <i key={s} className={`h-2 w-2 rounded-full border border-paper ${styleOf(s).dot}`} />
              ))}
            </span>
            {total} claims · {avg}%
          </>
        ) : (
          "◌ claims…"
        )}
      </span>

      {open && claims && (
        <span
          role="dialog"
          aria-label="Top claims"
          className="absolute bottom-full left-0 z-20 mb-2 w-72 border border-ink bg-paper p-4 text-left shadow-[4px_4px_0_#151515]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span className="flex font-mono text-[10px] uppercase">
            <span className="tracking-[0.16em] text-coral">Claim graph</span>
          </span>
          <span className="mt-2 flex h-2 w-full overflow-hidden border border-ink/20">
            {order.map((s) => (
              <i
                key={s}
                className={styleOf(s).dot}
                style={{ width: `${(counts[s] / total) * 100}%` }}
                title={`${counts[s]} ${s}`}
              />
            ))}
          </span>
          <span className="mt-3 block space-y-2">
            {claims.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => openClaim(e, c.id)}
                className="block w-full border border-ink/15 p-2 text-left hover:border-coral"
              >
                <span className="flex items-center justify-between font-mono text-[9px] uppercase">
                  <span className={styleOf(c.status).text}>{styleOf(c.status).label}</span>
                  <span className="text-muted">{Math.round((c.derived_confidence ?? 0) * 100)}%</span>
                </span>
                <span className="mt-1 line-clamp-2 block font-serif text-sm leading-snug">{c.text}</span>
              </button>
            ))}
          </span>
          <button
            type="button"
            onClick={(e) => openClaim(e, claims[0].id)}
            className="mt-3 font-mono text-[10px] uppercase text-coral underline"
          >
            Open in claim tab →
          </button>
        </span>
      )}
    </span>
  );
}
