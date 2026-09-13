"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuota, useGenerateArticle, useRefreshArticle, useTrackView, useArticle, useArticleProgress, useArticleStatus, useArticleEpistemic } from "../../hooks";
import PageLayout from "../../components/PageLayout";
import ContentCard from "../../components/ContentCard";
import GenerationBar from "../../components/GenerationBar";
import { articleToBlocks } from "../../components/BlockRenderer";
import { collectAnchorNumbers, stripClaimAnchors } from "@/lib/claim-parser";
import MagazineBody from "../../components/MagazineBody";
import ContestDialog from "../../components/ContestDialog";
import FactFile from "../../components/FactFile";
import KeyFactsBox from "../../components/KeyFactsBox";
import ClaimRail from "../../components/ClaimRail";
import ClaimDetail from "../../components/ClaimDetail";
import ClaimGraphViewer from "../../components/ClaimGraphViewer";
import FreshnessBadge from "../../components/FreshnessBadge";
import RefreshDiffBanner from "../../components/RefreshDiffBanner";
import ArticleGapsPanel from "../../components/ArticleGapsPanel";
import EpisodeFeed from "../../components/EpisodeFeed";
import LiveBadge from "../../components/LiveBadge";
import type { AgentEvent } from "../../components/ProcessViewer";
import type { Article } from "@encarta/core";
import { IconXCircle, IconBook, IconLightning, IconFile, IconFileText, IconUser, IconRefresh, IconAlert } from "../../components/Icons";
import RetroWindow from "../../components/retro/RetroWindow";
import RetroArticle from "../../components/retro/RetroArticle";
import { IS_RETRO } from "@/lib/retro";

interface ArticleClientProps {
  slug: string;
  article: Article | null;
  isGenerating: boolean;
  initialPhase: string;
}

export default function ArticleClient({ slug, article: initialArticle, isGenerating: initialIsGenerating, initialPhase }: ArticleClientProps) {
  // Prefer the React Query cache (also seeded by the server RSC fetch via
  // the same hook); fall back to the server-provided prop on first render.
  const { data: fetched, refetch: refetchArticle } = useArticle(slug);
  const article: Article | null = initialArticle ?? fetched ?? null;
  const isLoading = !article && !initialIsGenerating;
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(initialIsGenerating);
  const [progress, setProgress] = useState(initialPhase);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [pausedError, setPausedError] = useState<string | undefined>(undefined);
  const [showGraph, setShowGraph] = useState(false);
  const [dissentMode, setDissentMode] = useState(false);
  const [contestOpen, setContestOpen] = useState(false);
  const { data: epistemic } = useArticleEpistemic(generating ? undefined : slug);
  const epistemicClaims = useMemo(() => {
    const list = (epistemic as any)?.claims;
    return Array.isArray(list) ? list : [];
  }, [epistemic]);
  const claimsIndex = useMemo<Record<string, { status?: string; derived_confidence?: number; text?: string }>>(() => {
    const map: Record<string, { status?: string; derived_confidence?: number; text?: string }> = {};
    for (const c of epistemicClaims as Array<{ id: string; status?: string; derived_confidence?: number; text?: string }>) {
      if (c?.id) map[c.id] = { status: c.status, derived_confidence: c.derived_confidence, text: c.text };
    }
    return map;
  }, [epistemicClaims]);
  // Single block source for body, numbering, and deck — one reading order.
  const bodyBlocks = useMemo(() => {
    if (!article) return [];
    return article.blocks && article.blocks.length > 0
      ? article.blocks
      : articleToBlocks(
          article.slug,
          article.title,
          article.abstract,
          article.sections,
          article.timeline,
          article.crossrefs,
          article.citations,
        );
  }, [article]);
  const citeNumbers = useMemo(() => collectAnchorNumbers(bodyBlocks), [bodyBlocks]);
  const evidenceCounts = useMemo<Record<string, { supports: number; contradicts: number }>>(() => {
    const counts: Record<string, { supports: number; contradicts: number }> = {};
    const edges = (epistemic as any)?.claim_graph?.edges;
    if (Array.isArray(edges)) {
      for (const e of edges) {
        if (e?.type !== "evidence" || !e?.target) continue;
        const c = counts[e.target] ?? (counts[e.target] = { supports: 0, contradicts: 0 });
        if (e.relationship === "supports") c.supports++;
        else c.contradicts++;
      }
    }
    return counts;
  }, [epistemic]);
  // Claim trail state: active highlights chip + note together; trail opens
  // the drawer. Chips select without opening (their popover is the glance).
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [trailClaimId, setTrailClaimId] = useState<string | null>(null);
  const handleChipSelect = useCallback((id: string) => {
    setActiveClaimId(id);
    requestAnimationFrame(() => {
      document.getElementById(`claim-note-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);
  const openTrail = useCallback((id: string) => {
    setActiveClaimId(id);
    setTrailClaimId(id);
  }, []);
  const closeTrail = useCallback(() => {
    setTrailClaimId(null);
    setActiveClaimId(null);
  }, []);
  const trailClaim = useMemo(
    () => (epistemicClaims as Array<{ id: string }>).find((c) => c?.id === trailClaimId) ?? null,
    [epistemicClaims, trailClaimId]
  );
  const trailGaps = useMemo(() => {
    const gaps = (epistemic as any)?.gaps;
    if (!Array.isArray(gaps) || !trailClaimId) return [];
    return gaps.filter((g: any) => g?.claim_id === trailClaimId);
  }, [epistemic, trailClaimId]);
  const { data: quota } = useQuota();
  const { mutate: generateArticle } = useGenerateArticle();
  const { mutate: refreshArticle } = useRefreshArticle();
  const { data: status } = useArticleStatus(generating ? slug : undefined);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const trackedRef = useRef(false);
  const router = useRouter();
  const trackView = useTrackView();

  // Track view once per slug
  if (slug && !trackedRef.current) {
    trackedRef.current = true;
    trackView(slug);
  }

  // Drive the SSE connection while we're generating and don't yet have the
  // final article. Replaces the inline EventSource + listener block.
  useArticleProgress(generating ? slug : null, generating, {
    onAgentEvent: (ev) => setAgentEvents((prev) => [...prev, ev]),
    onPhase: (phase, err) => {
      setProgress(phase);
      setPausedError(phase === "paused" ? err : undefined);
    },
    onDone: () => {
      setGenerating(false);
      setProgress("done");
      refetchArticle();
    },
    onError: (e) => {
      setProgress("Error: " + e);
      setGenerating(false);
    },
  });

  // Sync phase from the polling status endpoint (older generation path).
  // The SSE hook is the source of truth for in-flight generations; this is a
  // safety net for the very first paint.
  if (status?.status && status.status !== "not_found" && !generating) {
    if (status.status === "done" || status.status === "published") {
      if (article && !fetched) refetchArticle();
    }
  }

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress("queued");
    setQuotaBlocked(false);
    try {
      const result = await generateArticle({ slug });
      if (result?.status === "error") {
        setError("Failed to generate article");
        setGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate article");
      setGenerating(false);
    }
  }, [slug, generateArticle]);

  const handleRefresh = useCallback(async () => {
    setGenerating(true);
    setProgress("queued");
    setQuotaBlocked(false);
    try {
      const result = await refreshArticle(slug);
      if (result?.status === "error") {
        setError("Failed to refresh article");
        setGenerating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh article");
      setGenerating(false);
    }
  }, [slug, refreshArticle]);

  const handleExport = useCallback((format: "json" | "markdown") => {
    if (!article) return;
    const url = `/api/articles/${slug}/export?format=${format}`;
    window.open(url, "_blank");
  }, [article, slug]);

  if (error && !article) {
    return (
      <ContentCard>
        <div className="flex items-center justify-center px-6 py-16">
          <div className="max-w-lg mx-auto text-center">
            <div className="mb-5"><IconXCircle size={44} /></div>
            <h1 className="text-xs font-semibold mb-2" style={{ color: "var(--red)" }}>Error Loading Article</h1>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>{error}</p>
            <button
              onClick={() => { setError(null); window.location.reload(); }}
              className="btn btn-primary cursor-pointer"
            >
              Try Again
            </button>
            <div className="mt-4">
              <Link href="/" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </ContentCard>
    );
  }

  if (isLoading) {
    return (
      <ContentCard>
        <div className="px-4 sm:px-8 py-10 sm:py-14 w-full animate-pulse">
          <div className="flex mb-10">
            <div className="w-16 h-16 rounded-full skeleton" />
          </div>
          <div className="mb-8 space-y-3">
            <div className="h-8 skeleton w-3/4 rounded" />
            <div className="h-7 skeleton w-1/2 rounded" />
            <div className="skeleton" style={{ width: "3rem", height: 2 }} />
            <div className="h-4 skeleton w-1/3 rounded mt-4" />
          </div>
          <div className="space-y-3 w-full">
            {[85, 70, 92, 78, 65, 88].map((w, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-4 skeleton flex-1 rounded" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      </ContentCard>
    );
  }

  if (!article && !generating) {
    const atLimit = quota && quota.remaining <= 0;
    return (
      <PageLayout maxWidthClass="max-w-3xl">
        <div
          style={{
            borderRadius: "var(--radius-card-lg)",
            background: "color-mix(in srgb, var(--surface-elevated) 100%, transparent)",
            border: "1px solid var(--border-light)",
            boxShadow: "0 1px 3px rgba(26,22,18,0.04)",
          }}
        >
        <div className="px-6 py-12 sm:py-16 flex items-center justify-center">
          <div className="max-w-lg mx-auto text-center stagger-children">
            <div
              className="w-16 h-16 mx-auto mb-6 flex items-center justify-center"
              style={{
                borderRadius: "var(--radius-card-lg)",
                background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)",
              }}
            >
              {atLimit ? <IconAlert size={26} style={{ color: "var(--oxblood)" }} /> : <IconBook size={26} style={{ color: "var(--accent)" }} />}
            </div>
            <h1 className="font-display font-bold mb-3" style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)", letterSpacing: "-0.01em", color: "var(--ink)", textTransform: "capitalize" }}>
              {slug.replace(/-/g, " ")}
            </h1>
            {atLimit ? (
              <>
                <p className="text-sm mb-3 font-medium" style={{ color: "var(--red)" }}>Generation limit reached</p>
                <p className="text-sm leading-relaxed mb-6 max-w-sm mx-auto" style={{ color: "var(--muted)" }}>
                  Your {quota.tier} plan allows {quota.limit} article generations. Upgrade to create more.
                </p>
                <Link href="/pricing" className="btn btn-primary btn-lg no-underline">
                  Upgrade plan
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm mb-2" style={{ color: "var(--subtle)" }}>Topic not yet in the encyclopedia</p>
                <p className="text-sm leading-relaxed mb-8 max-w-sm mx-auto" style={{ color: "var(--muted)" }}>
                  The AI agent will research the web, write a full article, and verify all citations.
                </p>
                <button
                  onClick={handleGenerate}
                  className="group btn btn-primary btn-lg cursor-pointer"
                  style={{ borderRadius: "9999px", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
                >
                  <span className="flex items-center gap-2">
                    <IconLightning size={16} />
                    <span>Generate article</span>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </span>
                </button>
                {quota && (
                  <p className="text-xs mt-5 font-medium" style={{ color: "var(--subtle)" }}>
                    <span className="tabular-nums">{quota.remaining} of {quota.limit}</span> generations remaining
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        </div>
      </PageLayout>
    );
  }

  if (generating && !article) {
    const hasError = progress.startsWith("Error:");
    const progressEntry = {
      slug,
      title: slug.replace(/-/g, " "),
      phase: progress || "queued",
      error: hasError ? progress.replace("Error: ", "") : pausedError,
      agentEvents,
    };

    return (
      <ContentCard>
        <div className="px-6 py-12 sm:py-16">
          <div className="max-w-lg mx-auto">
            <h1 className="text-xs font-semibold text-center mb-8 capitalize" style={{ color: "var(--ink)" }}>
              {slug.replace(/-/g, " ")}
            </h1>
            <GenerationBar
              entry={progressEntry}
              onRetry={() => handleGenerate()}
              onDismiss={() => {}}
              showWatchLive={false}
            />
            <EpisodeFeed events={agentEvents} />
          </div>
        </div>
      </ContentCard>
    );
  }

  if (!article) return null;

  // ponytail: retro branch — same data, Spinosaurus chrome. Old theme untouched.
  if (IS_RETRO) {
    return (
      <RetroWindow title={`Microsoft Encarta Encyclopedia 98 - ${article.title}`} address={`encarta.msn.com/${slug}`} status={`MS Encarta • ${slug}`}>
        <RetroArticle article={article} epistemic={epistemic} graph={(epistemic as any)?.claim_graph ?? null} />
      </RetroWindow>
    );
  }

  const hasFullContent = (article.blocks && article.blocks.length > 0) ||
    (article.sections && article.sections.length > 0);

  return (
    <PageLayout maxWidthClass="max-w-[88rem]">
      {/* No card frame — the page itself is the surface. */}
      <div className="w-full">
      <article className="px-4 sm:px-6 lg:px-10 pt-3 sm:pt-4 pb-6 sm:pb-8 w-full animate-appear-up">
        {/* Back link — gold badge with hover arrow */}
        <button
          onClick={() => router.back()}
          className="group inline-flex items-center gap-2 mb-4 no-underline cursor-pointer"
          style={{ color: "var(--muted)", background: "none", border: "none", padding: 0 }}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-500" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "var(--accent)", transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)" }}
              className="group-hover:-translate-x-0.5"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </span>
          <span className="text-[11px] font-medium tracking-wide" style={{ letterSpacing: "0.06em" }}>Back to encyclopedia</span>
        </button>

        {/* Admin float-island — floating pill at top-right */}
          <div
            className="flex items-center gap-1 mb-3 ml-auto w-max"
          style={{
            padding: "3px",
            borderRadius: "9999px",
            background: "color-mix(in srgb, var(--border) 15%, transparent)",
          }}
        >
          <div
            className="flex items-center gap-0.5 px-2 py-1"
            style={{
              borderRadius: "calc(9999px - 3px)",
              background: "var(--surface-glass)",
              backdropFilter: "blur(12px) saturate(1.3)",
              WebkitBackdropFilter: "blur(12px) saturate(1.3)",
            }}
          >
            <button
              onClick={handleRefresh}
              disabled={generating || (quota?.remaining != null && quota.remaining <= 0)}
              className="group relative w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-accent-bg/40 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={generating ? "Refreshing…" : "Regenerate article"}
              aria-label="Regenerate article"
            >
              <IconRefresh size={13} />
            </button>
            <button
              onClick={() => handleExport("json")}
              className="group relative w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-accent-bg/40 transition-all duration-200 cursor-pointer"
              title="Export JSON"
              aria-label="Export JSON"
            >
              <IconFile size={13} />
            </button>
            <button
              onClick={() => handleExport("markdown")}
              className="group relative w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-accent-bg/40 transition-all duration-200 cursor-pointer"
              title="Export Markdown"
              aria-label="Export Markdown"
            >
              <IconFileText size={13} />
            </button>
            {quota != null && quota.remaining <= 3 && (
              <span
                className="text-[9px] font-medium ml-1 px-2 py-0.5 rounded-full"
                style={{
                  color: quota.remaining === 0 ? "var(--oxblood)" : "var(--accent)",
                  background: quota.remaining === 0 ? "color-mix(in srgb, var(--oxblood) 10%, transparent)" : "color-mix(in srgb, var(--accent) 10%, transparent)",
                }}
              >
                <span className="tabular-nums">{quota.remaining}/{quota.limit}</span>
              </span>
            )}
          </div>
        </div>

        {/* Masthead — natural-history plate: folio row, Didone headline,
            italic deck, double rule, single controls row. */}
        <header className="plate-head">
          <div className="plate-folio">
            <span>/ {article.categories?.[0] ?? "article"}</span>
            <span>/ Vol. I{article.metadata?.version != null && ` · Rev. ${article.metadata.version}`}</span>
            {article.metadata?.updated && (
              <span>/ {new Date(article.metadata.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            )}
          </div>
          <h1 className="plate-title">
            {article.title || slug.replace(/-/g, " ")}
          </h1>

          {article.abstract && (
            <p className="plate-deck">
              {stripClaimAnchors(article.abstract)}
            </p>
          )}

          <div className="plate-rule" aria-hidden="true" />

          <div className="plate-controls">
            {article.metadata?.generatedBy && (
              <span className="plate-byline"><IconUser size={11} /> {article.metadata.generatedBy.slice(0, 12)}</span>
            )}
            {article.slug && <FreshnessBadge slug={article.slug} />}
            <LiveBadge slug={slug} />
            <span className="plate-sep" aria-hidden="true">·</span>
            <button
            onClick={() => setShowGraph(!showGraph)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer"
            style={{
              borderColor: "var(--border-light, #e5e5e5)",
              color: showGraph ? "var(--accent)" : "var(--muted)",
              background: showGraph ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
            }}
          >
            <span aria-hidden>◈</span> {showGraph ? "Hide claim graph" : "Show claim graph"}
          </button>
          <button
            onClick={() => setDissentMode(!dissentMode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer"
            style={{
              borderColor: dissentMode ? "rgba(179,60,60,0.45)" : "var(--border-light, #e5e5e5)",
              color: dissentMode ? "#b33c3c" : "var(--muted)",
              background: dissentMode ? "rgba(179,60,60,0.06)" : "transparent",
            }}
            title="Highlight disputed and weak claims in the body"
          >
            <span aria-hidden>⚑</span> {dissentMode ? "Dissent on" : "Highlight dissent"}
          </button>
          <button
            onClick={() => setContestOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer"
            style={{
              borderColor: "var(--border-light, #e5e5e5)",
              color: "var(--muted)",
              background: "transparent",
            }}
            title="Challenge this article with a counterpoint"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> Contest
          </button>
        </div>
        </header>

        <RefreshDiffBanner slug={slug} />

        <KeyFactsBox facts={(epistemic as any)?.key_facts ?? []} />

        <div className="mb-6" />
        {showGraph && (
          <div className="mb-6">
            <ClaimGraphViewer slug={slug} />
          </div>
        )}

        {/* Article body — folio grid: text column plus margin rail */}
        <div className="folio-grid">
        <div className="stagger-children">
          {hasFullContent ? (
            <MagazineBody
              blocks={bodyBlocks}
              claimsIndex={claimsIndex}
              dissentMode={dissentMode}
              activeClaimId={activeClaimId}
              onClaimSelect={handleChipSelect}
              citeNumbers={citeNumbers}
            />
          ) : article.abstract ? (
            <div style={{ fontSize: "0.9375rem", lineHeight: 1.75, color: "var(--ink)" }}>
              <p>{article.abstract}</p>
            </div>
          ) : null}
        </div>
        {/* Margin rail — claim sidenotes land here next slice. Empty rails
            collapse via :empty with zero layout cost. */}
        <aside className="folio-rail" aria-label="Claim notes">
          {epistemicClaims.length > 0 && (
            <ClaimRail
              claims={epistemicClaims}
              evidenceCounts={evidenceCounts}
              activeId={activeClaimId}
              onSelect={openTrail}
            />
          )}
        </aside>
        </div>

        <ArticleGapsPanel slug={slug} />
      </article>
      </div>
      {trailClaim && (
        <ClaimDetail
          claim={trailClaim}
          graph={(epistemic as any)?.claim_graph ?? null}
          gaps={trailGaps}
          allClaims={epistemicClaims}
          onClose={closeTrail}
          onSelectClaim={openTrail}
        />
      )}
      <ContestDialog
        slug={slug}
        open={contestOpen}
        onClose={() => setContestOpen(false)}
        onQueued={() => {
          setGenerating(true);
          setProgress("queued");
        }}
      />
    </PageLayout>
  );
}
