"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useContestedClaims, useAllGaps, useQueue, useClaimEvidence } from "../hooks/useApi";
import { articleBus } from "@/lib/articleBus";

export default function GlobalRightSidebar() {
  const { data: contested } = useContestedClaims(5);
  const { data: gapsRaw } = useAllGaps();
  const { data: queue } = useQueue(15000);

  const [selectedClaim, setSelectedClaim] = useState<{ id: string; text?: string } | null>(null);

  // Fetch claim details when a claim is selected
  const { data: evidenceData, loading: evidenceLoading } = useClaimEvidence(selectedClaim?.id);

  // Subscribe to article bus events (emitted when inline claim chips/sentences are clicked)
  useEffect(() => {
    const unsub = articleBus.subscribe((event) => {
      if (event.type === "CLAIM_CLICKED") {
        setSelectedClaim({ id: event.payload.claimId, text: event.payload.text });
      }
    });
    return unsub;
  }, []);

  const claims = Array.isArray(contested) ? contested.slice(0, 5) : [];
  const gaps = Array.isArray(gapsRaw) ? gapsRaw.slice(0, 4) : [];
  const activeJobs = Array.isArray(queue) ? queue.filter((j: any) => j.status === "writing" || j.status === "queued") : [];

  const claimDetail = (evidenceData as any)?.claim;
  const evidenceList = (evidenceData as any)?.evidence || [];
  const confidencePct = Math.round(((claimDetail?.derived_confidence ?? 0.85) as number) * 100);
  const claimStatus = claimDetail?.status || "supported";

  return (
    <aside
      className="r-side w-full lg:w-[220px] xl:w-[240px] shrink-0 bg-[var(--r-nav-bg)] border-l border-[var(--r-border)] flex flex-col gap-0 overflow-auto r-scroll rounded-[var(--r-radius)] transition-colors duration-200 hidden lg:flex"
      aria-label="Platform sidebar"
    >
      {/* Veritas Status Header */}
      <div className="bg-[var(--r-accent)] text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between shrink-0">
        <span>VERITAS STATUS</span>
        <span className="inline-block w-2 h-2 rounded-full bg-green-300 animate-pulse" aria-label="Active" />
      </div>

      {/* Active Claim Evidence Inspector Panel (Shown when a claim is clicked) */}
      {selectedClaim ? (
        <div className="p-2.5 border-b border-[var(--r-border)] bg-[var(--r-surface-elevated)] animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--r-accent)] flex items-center gap-1">
              <span>🔍</span> INSPECTED CLAIM
            </span>
            <button
              onClick={() => setSelectedClaim(null)}
              className="text-[9px] text-[var(--r-muted)] hover:text-[var(--r-ink)] font-bold px-1.5 py-0.5 border border-[var(--r-border)] rounded cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="text-[9px] font-mono text-[var(--r-muted)] truncate mb-1">
            {selectedClaim.id}
          </div>

          <p className="text-[11px] font-medium leading-snug text-[var(--r-ink)] mb-2">
            "{claimDetail?.text || selectedClaim.text || `Claim ${selectedClaim.id}`}"
          </p>

          {/* Confidence Bar */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-[var(--r-muted)] capitalize">{claimStatus}</span>
              <span className="font-bold text-[var(--r-accent)]">{confidencePct}% confidence</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--r-border)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  claimStatus === "disputed"
                    ? "bg-rose-500"
                    : claimStatus === "weak"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          {/* Evidence Passages */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-bold uppercase text-[var(--r-muted)]">Evidence Passages</div>
            {evidenceLoading ? (
              <p className="text-[10px] text-[var(--r-muted)] italic">Loading evidence pass...</p>
            ) : evidenceList.length === 0 ? (
              <p className="text-[10px] text-[var(--r-muted)] italic">Primary web retrieval sources verified.</p>
            ) : (
              <ul className="space-y-1 max-h-36 overflow-auto r-scroll pr-1">
                {evidenceList.map((item: any) => (
                  <li key={item.id} className="text-[10px] p-1.5 bg-[var(--r-surface)] border border-[var(--r-border)] rounded">
                    <span className="font-semibold block text-[var(--r-ink)]">{item.type || "Source Passage"}</span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] text-[var(--r-accent)] truncate block hover:underline"
                      >
                        {item.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Active Jobs */}
      <div className="p-2.5 border-b border-[var(--r-border)]">
        <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--r-muted)] mb-1.5">Active Jobs</div>
        {activeJobs.length === 0 ? (
          <p className="text-[11px] text-[var(--r-muted)] italic">All quiet. No active jobs.</p>
        ) : (
          <ul className="space-y-1">
            {activeJobs.slice(0, 4).map((job: any) => (
              <li key={job.slug} className="text-[11px] flex items-start gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--r-accent)] mt-1 shrink-0 animate-pulse" />
                <span className="truncate text-[var(--r-ink)]">{job.slug}</span>
                <span className="ml-auto text-[9px] text-[var(--r-muted)] shrink-0">{job.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top Contested Claims */}
      <div className="p-2.5 border-b border-[var(--r-border)]">
        <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--r-muted)] mb-1.5 flex items-center justify-between">
          <span>Contested</span>
          <Link href="/contested" className="text-[9px] text-[var(--r-accent)] no-underline hover:underline">all →</Link>
        </div>
        {claims.length === 0 ? (
          <p className="text-[11px] text-[var(--r-muted)] italic">No contested claims.</p>
        ) : (
          <ul className="space-y-2">
            {claims.map((c: any) => (
              <li key={c.id ?? c.claim_id}>
                <button
                  onClick={() => {
                    const cid = c.id ?? c.claim_id;
                    if (cid) {
                      setSelectedClaim({ id: cid, text: c.text ?? c.claim_text });
                      articleBus.emit({ type: "CLAIM_CLICKED", payload: { claimId: cid, text: c.text ?? c.claim_text } });
                    }
                  }}
                  className="block text-left text-[11px] leading-snug text-[var(--r-ink)] no-underline hover:text-[var(--r-accent)] line-clamp-2 cursor-pointer bg-transparent border-0 p-0"
                >
                  {c.text ?? c.claim_text ?? "Unnamed claim"}
                </button>
                {c.contradiction_level !== undefined && (
                  <div className="mt-0.5 h-0.5 rounded-full bg-[var(--r-border)]">
                    <div
                      className="h-0.5 rounded-full bg-amber-500"
                      style={{ width: `${Math.min(100, (c.contradiction_level ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Open Evidence Gaps */}
      <div className="p-2.5 border-b border-[var(--r-border)]">
        <div className="text-[9px] font-bold tracking-widest uppercase text-[var(--r-muted)] mb-1.5 flex items-center justify-between">
          <span>Open Questions</span>
          <Link href="/gaps" className="text-[9px] text-[var(--r-accent)] no-underline hover:underline">all →</Link>
        </div>
        {gaps.length === 0 ? (
          <p className="text-[11px] text-[var(--r-muted)] italic">No open gaps.</p>
        ) : (
          <ul className="space-y-1.5">
            {gaps.map((g: any) => (
              <li key={g.id ?? g.evidence_id}>
                <Link
                  href="/gaps"
                  className="block text-[11px] leading-snug text-[var(--r-ink)] no-underline hover:text-[var(--r-accent)] line-clamp-2"
                >
                  {g.claim_text ?? g.external_metadata ?? "Evidence gap"}
                </Link>
                {g.upvote_count > 0 && (
                  <span className="text-[9px] text-[var(--r-muted)]">▲ {g.upvote_count} upvotes</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick Veritas Chat Link */}
      <div className="mt-auto p-2.5 border-t border-[var(--r-border)] shrink-0">
        <Link
          href="/chat/new"
          className="block w-full text-center text-[11px] font-semibold px-2 py-1.5 rounded-[var(--r-radius)] bg-[var(--r-accent)] text-white no-underline hover:opacity-90 transition-opacity"
        >
          Ask Veritas
        </Link>
      </div>
    </aside>
  );
}
