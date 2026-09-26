"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useClaimSearch, useClaimEvidence, useVerifyClaim, useRecentDossiers } from "../hooks";
import { useUiMode } from "../context/UiModeContext";
import ClaimDetailModal from "../components/article/ClaimDetailModal";
import type { ClaimItem } from "../components/article/GroupedClaimsList";
import type { ClaimDossier, ClaimDossierSource, ClaimVerifyResult } from "@/lib/api";

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

// Dossier verdicts share the corpus vocabulary so the two halves of the page
// read as one instrument.
function dossierVerdict(verdict?: string) {
  const s = (verdict || "").toLowerCase();
  if (s === "supported") return { label: "Supported", className: "text-forest", bar: "bg-forest" };
  if (s === "contested") return { label: "Contested", className: "text-oxblood", bar: "bg-oxblood" };
  if (s === "weak") return { label: "Weak support", className: "text-gold", bar: "bg-gold" };
  return { label: "Unverified", className: "text-muted", bar: "bg-ink/30" };
}

function EvidenceColumn({
  heading,
  headingClass,
  sources,
  emptyText,
}: {
  heading: string;
  headingClass: string;
  sources: ClaimDossierSource[];
  emptyText: string;
}) {
  return (
    <div>
      <h4 className={`text-[11px] font-mono uppercase tracking-[0.18em] mb-2 ${headingClass}`}>
        {heading} ({sources.length})
      </h4>
      {sources.length > 0 ? (
        <ul className="space-y-3">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="block text-[13px] font-medium text-ink hover:text-gold transition-colors leading-snug"
              >
                {s.title}
              </a>
              {s.source && (
                <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-subtle mt-0.5">
                  {s.source}
                </span>
              )}
              {s.quote && (
                <span className="block font-serif italic text-[12px] text-muted leading-relaxed mt-1 border-l-2 border-rule pl-2">
                  &ldquo;{s.quote}&rdquo;
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-serif italic text-sm text-subtle">{emptyText}</p>
      )}
    </div>
  );
}

export default function FinderPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { widthMode, alignClass } = useUiMode();
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

  const { data: verifyRes, loading: verifying, mutate: runVerify } = useVerifyClaim();
  const web: ClaimVerifyResult | null = (verifyRes as ClaimVerifyResult | undefined) ?? null;
  const dossier: ClaimDossier | null = web?.dossier ?? null;
  const [tooShort, setTooShort] = useState(false);

  const { data: recentRes } = useRecentDossiers(6);
  const recent = ((recentRes as any)?.dossiers as any[] | undefined) ?? [];

  // One submit drives both halves: corpus lookup (via debounce) and the
  // open-web verification. refresh=true bypasses the 24h dossier cache.
  const verify = (statement: string, refresh = false) => {
    const s = statement.trim();
    if (s.length < 8) {
      setTooShort(true);
      return;
    }
    setTooShort(false);
    void runVerify({ statement: s, refresh });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebounced(query.trim());
    verify(query);
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
  const dossierV = dossier ? dossierVerdict(dossier.verdict) : null;
  const dossierPct = dossier ? Math.round((dossier.confidence ?? 0) * 100) : 0;
  const searched = debounced.length > 0 || !!web;

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass} ${alignClass} transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Corpus + open web</span>
            <span>Search any claim</span>
          </div>
          <h1 className="plate-title">Claim finder</h1>
          <p className="plate-deck">
            Search every claim the encyclopedia has published — or paste any
            statement and Veritas will retrieve live sources, adjudicate it, and
            return a dossier with evidence on both sides.
          </p>
          <form onSubmit={handleSubmit} role="search" className="mt-5">
            <div className="flex items-center gap-3 border-b-2 border-ink pb-2 focus-within:border-gold transition-colors">
              <span className="text-subtle text-lg leading-none" aria-hidden>⌕</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Cold fusion has never produced net energy gain…"
                aria-label="Search or verify a claim"
                className="flex-1 bg-transparent border-none outline-none font-serif text-lg text-ink placeholder:text-subtle min-w-0"
              />
              <button
                type="submit"
                disabled={verifying || !query.trim()}
                className="text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-gold disabled:opacity-30 disabled:no-underline cursor-pointer shrink-0"
              >
                {verifying ? "Verifying…" : "Verify →"}
              </button>
            </div>
          </form>
          {tooShort && (
            <p className="mt-2 text-[12px] font-mono uppercase tracking-[0.14em] text-oxblood">
              Give the finder at least eight characters to work with.
            </p>
          )}
          <div className="plate-rule" />
        </div>

        {/* ── Open-web verification ─────────────────────────────── */}
        {verifying && (
          <section className="py-8" aria-live="polite">
            <p className="font-serif italic text-muted">
              Retrieving sources across the web and adjudicating…
            </p>
            <div className="mt-4 space-y-2" aria-hidden>
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-3 w-3/5" />
            </div>
          </section>
        )}

        {!verifying && web && (
          <section className="py-8" aria-label="Open-web verification">
            {dossier && dossierV ? (
              <div className="border border-rule rounded-sharp bg-surface-elevated p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                    Open-web verdict
                  </span>
                  <span className={`text-[11px] font-mono uppercase tracking-[0.18em] font-medium ${dossierV.className}`}>
                    {dossierV.label}
                  </span>
                  <span className="font-mono text-xs text-subtle tabular-nums">{dossierPct}% confidence</span>
                  {dossier.grounded ? (
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] border border-forest/40 text-forest px-2 py-0.5">
                      Grounded · {dossier.sources_reviewed} sources
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] border border-oxblood/40 text-oxblood px-2 py-0.5">
                      Model-only · retrieval offline
                    </span>
                  )}
                  {web.cached && (
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">
                      Cached verdict
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => verify(web.statement, true)}
                    className="ml-auto text-xs font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-gold cursor-pointer"
                  >
                    Re-verify
                  </button>
                </div>

                <p className="font-serif text-2xl leading-snug text-ink">
                  &ldquo;{web.statement}&rdquo;
                </p>
                <div className="w-full h-[3px] bg-ink/10 overflow-hidden" aria-hidden>
                  <div className={`h-full ${dossierV.bar}`} style={{ width: `${dossierPct}%` }} />
                </div>
                {dossier.rationale && (
                  <p className="font-serif text-[16px] leading-relaxed text-ink-secondary">
                    {dossier.rationale}
                  </p>
                )}


                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                  <EvidenceColumn
                    heading="Supporting"
                    headingClass="text-forest"
                    sources={dossier.supporting ?? []}
                    emptyText="No supporting source retrieved."
                  />
                  <EvidenceColumn
                    heading="Contradicting"
                    headingClass="text-oxblood"
                    sources={dossier.contradicting ?? []}
                    emptyText="No contradicting source retrieved."
                  />
                  <EvidenceColumn
                    heading="Context"
                    headingClass="text-gold"
                    sources={dossier.context ?? []}
                    emptyText="No contextual source retrieved."
                  />
                </div>

                {dossier.caveats?.length > 0 && (
                  <div className="pt-3 border-t border-border-light space-y-1.5">
                    <h4 className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                      Caveats
                    </h4>
                    <ul className="space-y-1">
                      {dossier.caveats.map((c, i) => (
                        <li key={i} className="font-serif italic text-[13px] text-muted leading-relaxed">
                          — {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle pt-1">
                  {dossier.model ? `${dossier.model} · ` : ""}
                  {dossier.checked_at ? `checked ${new Date(dossier.checked_at).toLocaleString()} · ` : ""}
                  citations allow-listed against retrieved documents
                </p>
              </div>
            ) : (
              <div className="border border-oxblood/30 rounded-sharp bg-oxblood-subtle/40 p-5 space-y-2">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-oxblood">
                  Open-web verification unavailable
                </h3>
                <p className="font-serif text-[15px] text-ink-secondary leading-relaxed">
                  {web.note ?? "The adjudicator could not be reached. Corpus findings are shown below."}
                </p>
              </div>
            )}
          </section>
        )}


        {/* ── Corpus findings ───────────────────────────────────── */}
        {searched && (
          <div className="py-8">
            {loading ? (
              <p className="font-serif italic text-muted py-8">Consulting the corpus…</p>
            ) : !top ? (
              <div className="py-8 space-y-2">
                <h2 className="font-display text-xl font-bold text-ink">Not in the corpus yet</h2>
                <p className="font-serif italic text-muted">
                  No encyclopedia entry asserts this statement.{" "}
                  {dossier
                    ? "The open-web dossier above is the verdict of record."
                    : "The open-web dossier above will answer when the adjudicator is reachable."}
                </p>
                <p className="text-sm text-muted">
                  Want it published?{" "}
                  <Link href="/article/new" className="category-link no-underline font-semibold">
                    Synthesize an article
                  </Link>{" "}
                  to seed the claim graph.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                <section className="border border-rule rounded-sharp bg-surface-elevated p-6 sm:p-8 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                      In our corpus
                    </span>
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


                {/* More corpus matches */}
                {rest.length > 0 && (
                  <section>
                    <h2 className="font-display text-xl font-bold text-ink mb-3">Further corpus matches</h2>
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

        {/* ── Recently verified claims (idle state) ──────────────── */}
        {!searched && recent.length > 0 && (
          <section className="py-8">
            <h2 className="font-display text-xl font-bold text-ink mb-1">Recently verified on the open web</h2>
            <p className="font-serif italic text-sm text-muted mb-4">
              Statements other readers checked. Selecting one re-runs verification live.
            </p>
            <div className="ledger">
              {recent.map((d: any, i: number) => {
                const v = dossierVerdict(d.verdict);
                return (
                  <button
                    key={`${d.updated_at}-${i}`}
                    onClick={() => {
                      setQuery(d.statement);
                      verify(d.statement);
                    }}
                    className="ledger-row group w-full text-left"
                  >
                    <span className="index-numeral">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-serif text-[16px] leading-snug text-ink group-hover:text-gold transition-colors">
                        {d.statement}
                      </span>
                      <span className="block text-xs text-muted truncate mt-1">
                        <span className={`font-medium ${v.className}`}>{v.label}</span>
                        {typeof d.sources_reviewed === "number" ? ` · ${d.sources_reviewed} sources` : ""}
                        {d.grounded ? " · grounded" : " · model-only"}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-subtle tabular-nums shrink-0">
                      {Math.round((d.confidence ?? 0) * 100)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <ClaimDetailModal claim={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

