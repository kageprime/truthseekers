"use client";
import Link from "next/link";
import { useContestedClaims, useAllGaps, useQueue } from "../hooks/useApi";

export default function GlobalRightSidebar() {
  const { data: contested } = useContestedClaims(5);
  const { data: gapsRaw } = useAllGaps();
  const { data: queue } = useQueue(15000);

  const claims = Array.isArray(contested) ? contested.slice(0, 5) : [];
  const gaps = Array.isArray(gapsRaw) ? gapsRaw.slice(0, 4) : [];
  const activeJobs = Array.isArray(queue) ? queue.filter((j: any) => j.status === "writing" || j.status === "queued") : [];

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
                <Link
                  href={c.article_slug ? `/article/${c.article_slug}` : "/contested"}
                  className="block text-[11px] leading-snug text-[var(--r-ink)] no-underline hover:text-[var(--r-accent)] line-clamp-2"
                >
                  {c.text ?? c.claim_text ?? "Unnamed claim"}
                </Link>
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
