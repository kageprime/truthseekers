"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useClaimSearch, useClaimEvidence } from "../hooks";
import { useUiMode } from "../context/UiModeContext";
import ClaimDetailModal from "../components/article/ClaimDetailModal";
import type { ClaimItem } from "../components/article/GroupedClaimsList";

interface FoundClaim {
  id: string;
  text: string;
  status: string;
  derived_confidence: number;
  article_slug?: string;
  confidence_vector?: Record<string, number>;
}

function verdictOf(status?: string) {
  const s = (status || "unknown").toLowerCase();
  if (s === "disputed" || s === "contested") return { label: "Contested", className: "text-oxblood" };
  if (s === "weak") return { label: "Weak support", className: "text-gold" };
  if (s === "supported" || s === "verified") return { label: "Supported", className: "text-forest" };
  return { label: "Unverified", className: "text-muted" };
}

export default function FinderPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { widthMode } = useUiMode();
  const [selected, setSelected] = useState<ClaimItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: res, loading } = useClaimSearch(debounced);
  const claims = ((res as any)?.claims as FoundClaim[] | undefined) ?? [];
  const top = claims[0] ?? null;
  const rest = claims.slice(1);

  const { data: evidenceRes } = useClaimEvidence(top?.id);
  const evidence = (evidenceRes as any)?.evidence ?? [];
  const supporting = evidence.filter((e: any) => e.supports_claim);
  const contradicting = evidence.filter((e: any) => !e.supports_claim);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebounced(query.trim());
  };

  const toItem = (c: FoundClaim): ClaimItem => ({
    id: c.id,
    text: c.text,
    status: c.status,
    derived_confidence: c.derived_confidence,
    contradiction_level: c.confidence_vector?.contradiction_level,
    confidence_vector: c.confidence_vector,
  });

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";
  const verdict = top ? verdictOf(top.status) : null;
  const confPct = top ? Math.round((top.derived_confidence ?? 0) * 100) : 0;

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} mx-auto transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Corpus lookup</span>
            <span>Paste any statement</span>
          </div>
          <h1 className="plate-title">Claim finder</h1>
          <p className="plate-deck">
            Look up any assertion against the verified corpus — verdict,
            evidence on both sides, and provenance.
          </p>
          <form onSubmit={handleSubmit} role="search" className="mt-5">
            <div className="flex items-center gap-3 border-b-2 border-ink pb-2 focus-within:border-gold transition-colors">
              <span className="text-subtle text-lg leading-none" aria-hidden>⌕</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. transmon coherence exceeds 100 microseconds…"
                aria-label="Search claims"
                className="flex-1 bg-transparent border-none outline-none font-serif text-lg text-ink placeholder:text-subtle min-w-0"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-gold disabled:opacity-30 disabled:no-underline cursor-pointer shrink-0"
              >
                Verify →
              </button>
            </div>
          </form>
          <div className="plate-rule" />
        </div>

        {debounced && (
          <div className="py-8">
            {loading ? (
              <p className="font-serif italic text-muted py-8 text-center">Consulting the corpus…</p>
            ) : !top ? (
              <div className="text-center py-12 space-y-3">
                <p className="font-serif italic text-lg text-muted">
                  No record of that assertion in the corpus.
                </p>
                <p className="text-sm text-muted">
                  Try fewer words — or{" "}
                  <Link href="/article/new" className="category-link no-underline font-semibold">
                    synthesize an article
                  </Link>{" "}
                  to seed it.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Dossier */}
                <section className="border border-rule rounded-sharp bg-surface-elevated p-6 sm:p-8 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[11px] font-mono uppercase tracking-[0.18em] font-medium ${verdict!.className}`}>
                      {verdict!.label}
                    </span>
                    <span className="font-mono text-xs text-subtle tabular-nums">{confPct}% confidence</span>
                    {top.article_slug && (
                      <Link href={`/article/${top.article_slug}`} className="category-link no-underline text-xs font-medium ml-auto">
                        Read in {top.article_slug.replace(/-/g, " ")} →
                      </Link>
                    )}
                  </div>
                  <p className="font-serif text-2xl leading-snug text-ink">
                    &ldquo;{top.text}&rdquo;
                  </p>
                  <div className="w-full h-[3px] bg-ink/10 overflow-hidden" aria-hidden>
                    <div className="h-full bg-gold" style={{ width: `${confPct}%` }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div>
                      <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-forest mb-2">
                        Supporting ({supporting.length})
                      </h3>
                      {supporting.length > 0 ? (
                        <ul className="space-y-2">
                          {supporting.slice(0, 4).map((ev: any, i: number) => (
                            <li key={ev.id || i}>
                              <a href={ev.url} target="_blank" rel="noreferrer" className="block text-[13px] text-ink hover:text-gold truncate transition-colors">
                                {ev.title || ev.url}
                              </a>
                              <span className="text-[11px] text-subtle">{ev.chain_of_custody || "unverified"} custody</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif italic text-sm text-subtle">No supporting records.</p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-oxblood mb-2">
                        Contradicting ({contradicting.length})
                      </h3>
                      {contradicting.length > 0 ? (
                        <ul className="space-y-2">
                          {contradicting.slice(0, 4).map((ev: any, i: number) => (
                            <li key={ev.id || i}>
                              <a href={ev.url} target="_blank" rel="noreferrer" className="block text-[13px] text-ink hover:text-gold truncate transition-colors">
                                {ev.title || ev.url}
                              </a>
                              <span className="text-[11px] text-subtle">{ev.chain_of_custody || "unverified"} custody</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif italic text-sm text-subtle">No contradicting records.</p>
                      )}
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setSelected(toItem(top))}
                      className="text-xs font-semibold text-oxblood underline decoration-oxblood/30 hover:decoration-oxblood underline-offset-4 cursor-pointer"
                    >
                      Contest with counterpoint
                    </button>
                  </div>
                </section>

                {/* More matches */}
                {rest.length > 0 && (
                  <section>
                    <h2 className="font-display text-xl font-bold text-ink mb-3">Further matches</h2>
                    <div className="ledger">
                      {rest.map((c, i) => {
                        const v = verdictOf(c.status);
                        return (
                          <button key={c.id || i} onClick={() => setSelected(toItem(c))} className="ledger-row group w-full text-left">
                            <span className="index-numeral">{String(i + 2).padStart(2, "0")}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-serif text-[16px] leading-snug text-ink group-hover:text-gold transition-colors">
                                {c.text}
                              </span>
                              <span className="block text-xs text-muted truncate mt-1">
                                <span className={`font-medium ${v.className}`}>{v.label}</span>
                                {c.article_slug ? ` · ${c.article_slug.replace(/-/g, " ")}` : ""}
                              </span>
                            </span>
                            <span className="font-mono text-xs text-subtle tabular-nums shrink-0">
                              {Math.round((c.derived_confidence ?? 0) * 100)}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ClaimDetailModal claim={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
