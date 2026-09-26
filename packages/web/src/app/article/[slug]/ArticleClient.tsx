"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useQuota,
  useGenerateArticle,
  useRefreshArticle,
  useTrackView,
  useArticle,
  useArticleProgress,
  useArticleStatus,
  useArticleEpistemic,
  useGlobalClaimGraph,
} from "../../hooks";
import GenerationBar from "../../components/GenerationBar";
import EpisodeFeed from "../../components/EpisodeFeed";
import type { AgentEvent } from "../../components/ProcessViewer";
import type { Article } from "@encarta/core";
import { useUiMode } from "../../context/UiModeContext";
import { articleToBlocks } from "../../components/BlockRenderer";
import PlateHead from "../../components/PlateHead";
import MagazineFlow from "../../components/MagazineFlow";
import ArticleContents from "../../components/article/ArticleContents";
import { MediaImage } from "../../components/MediaImage";
import InfoboxCard from "../../components/article/InfoboxCard";
import GroupedClaimsList, { type ClaimItem } from "../../components/article/GroupedClaimsList";
import ClaimDetailRail from "../../components/article/ClaimDetailRail";
import InteractiveCalcCard from "../../components/article/InteractiveCalcCard";
import QuizCard from "../../components/article/QuizCard";
import ArticleTour, { type TourStep } from "../../components/article/ArticleTour";

interface ArticleClientProps {
  slug: string;
  article: Article | null;
  isGenerating: boolean;
  initialPhase: string;
}

export default function ArticleClient({
  slug,
  article: initialArticle,
  isGenerating: initialIsGenerating,
  initialPhase,
}: ArticleClientProps) {
  const { data: fetched, refetch: refetchArticle } = useArticle(slug);
  const article: Article | null = initialArticle ?? fetched ?? null;
  const isLoading = !article && !initialIsGenerating;
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(initialIsGenerating);
  const [progress, setProgress] = useState(initialPhase);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [pausedError, setPausedError] = useState<string | undefined>(undefined);
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const readingRef = useRef<HTMLElement | null>(null);

  const { containerClass } = useUiMode();
  const { data: epistemic } = useArticleEpistemic(generating ? undefined : slug);

  const epistemicClaims = useMemo<ClaimItem[]>(() => {
    const list = (epistemic as any)?.claims;
    if (Array.isArray(list) && list.length > 0) {
      // ponytail: DB speaks supported/disputed/weak/unknown; the reader
      // speaks verified/contested/developing. Normalize once here.
      const normalize = (s: string) => {
        const v = (s || "").toLowerCase();
        if (v === "supported" || v === "verified") return "verified";
        if (v === "disputed" || v === "contested") return "contested";
        if (v === "weak" || v === "debated" || v === "developing") return "developing";
        return "unknown";
      };
      return list.map((c: any) => ({
        id: c.id,
        text: c.text,
        status: normalize(c.status),
        derived_confidence: c.derived_confidence ?? 0.95,
        source_title: c.source_title || "Verified Primary Source",
        contradiction_level: c.confidence_vector?.contradiction_level,
        confidence_vector: c.confidence_vector,
        evidence: c.evidence,
        signature: c.signature,
      }));
    }
    return [];
  }, [epistemic]);

  // Status/confidence lookup so inline [claim:id] chips render with color
  // and open previews without another round-trip.
  const claimsIndex = useMemo(() => {
    const idx: Record<string, { status?: string; derived_confidence?: number; text?: string }> = {};
    for (const c of epistemicClaims) {
      idx[c.id] = { status: c.status, derived_confidence: c.derived_confidence, text: c.text };
    }
    return idx;
  }, [epistemicClaims]);

  const graphEdges = useMemo(() => {
    const edges = (epistemic as any)?.claim_graph?.edges;
    return Array.isArray(edges) ? edges : [];
  }, [epistemic]);

  const articleGaps = useMemo(() => {
    const gaps = (epistemic as any)?.gaps;
    return Array.isArray(gaps) ? gaps : [];
  }, [epistemic]);

  const versionDiffs = useMemo(() => {
    const diffs = (epistemic as any)?.refresh_diff?.claim_diffs;
    return Array.isArray(diffs) ? diffs : [];
  }, [epistemic]);

  // Hero figure: first section image with a source. Rendered as the plate
  // figure; the matching block is dropped below so it never shows twice.
  const heroMedia = useMemo(() => {
    for (const sec of article?.sections ?? []) {
      const m = (sec.media ?? []).find((mm: any) => mm.type === "image" && mm.src);
      if (m) return m;
    }
    return null;
  }, [article]);

  // Reading flow through the shared block pipeline (figures, diagrams,
  // charts, maps, timeline) with inline claim chips. Server blocks win when
  // present; citations + related-articles stay custom below (journal ledger).
  const contentBlocks = useMemo(() => {
    if (!article) return [];
    const dropHeading = (text: string) => /^(citations|related articles)$/i.test((text ?? "").trim());
    if (article.blocks && article.blocks.length > 0) {
      return article.blocks.filter((b: any) => {
        if (b.type === "citation" || b.type === "crossref") return false;
        if (b.type === "heading" && dropHeading(b.data?.text)) return false;
        if (b.type === "image" && heroMedia && b.data?.src === (heroMedia as any).src) return false;
        return true;
      });
    }
    const all = articleToBlocks(
      slug,
      article.title || "",
      "",
      (article.sections ?? []) as any,
      (article.timeline ?? []) as any,
      [],
      [],
    );
    return all.filter((b: any) => {
      if (b.type === "heading" && b.data?.level === 1) return false;
      if (b.type === "image" && heroMedia && b.data?.src === (heroMedia as any).src) return false;
      return true;
    });
  }, [article, slug, heroMedia]);

  const handleChipSelect = useCallback(
    (id: string) => {
      const found = epistemicClaims.find((c) => c.id === id);
      if (found) setSelectedClaim(found);
    },
    [epistemicClaims],
  );

  const tourSteps = useMemo<TourStep[]>(() => {
    const sections = article?.sections ?? [];
    if (sections.length < 2) return [];
    return sections.slice(0, 8).map((sec: any) => ({
      title: sec.title || "Untitled section",
      excerpt: String(sec.content || "").slice(0, 140) || "Continue reading…",
    }));
  }, [article]);

  // Cross-article traversal: same assertion disputed in other articles.
  // Matched by claim signature, falling back to normalized text (global graph
  // nodes carry no signature). Fetched lazily via React Query hook.
  const { data: globalGraphData } = useGlobalClaimGraph(selectedClaim ? 150 : 0, 0);

  const elsewhere = useMemo(() => {
    if (!selectedClaim || !globalGraphData) return [];
    const norm = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const wantSig = (selectedClaim as any).signature || "";
    const wantText = norm(selectedClaim.text);
    const out: Array<{ id: string; slug: string; title: string; text: string; status: string; confidence: number }> = [];
    for (const n of (globalGraphData.nodes as any[]) ?? []) {
      if (n?.type !== "claim" || n.article_slug === slug) continue;
      const st = String(n.status || "").toLowerCase();
      if (!["disputed", "weak", "contested"].includes(st)) continue;
      const match =
        (wantSig && (n as any).signature && (n as any).signature === wantSig) ||
        (wantText && norm(n.label || "") === wantText);
      if (!match) continue;
      out.push({
        id: n.id,
        slug: n.article_slug,
        title: n.article_title || n.article_slug,
        text: n.label || "",
        status: n.status,
        confidence: n.confidence ?? 0,
      });
      if (out.length >= 5) break;
    }
    return out;
  }, [selectedClaim, globalGraphData, slug]);

  const { data: quota } = useQuota();
  const { mutate: generateArticle } = useGenerateArticle();
  const { mutate: refreshArticle } = useRefreshArticle();
  const { data: status } = useArticleStatus(generating ? slug : undefined);  const trackedRef = useRef(false);
  const trackView = useTrackView();

  if (slug && !trackedRef.current) {
    trackedRef.current = true;
    trackView(slug);
  }

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

  if (status?.status && status.status !== "not_found" && !generating) {
    if (status.status === "done" || status.status === "published") {
      if (article && !fetched) refetchArticle();
    }
  }

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress("queued");
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

  // Loading state
  if (isLoading) {
    return (
      <div className="py-16 px-6 max-w-3xl mx-auto space-y-6">
        <div className="h-6 w-36 skeleton" />
        <div className="h-12 w-3/4 skeleton" />
        <div className="h-20 w-full skeleton" />
        <div className="space-y-3 pt-6">
          <div className="h-4 w-full skeleton" />
          <div className="h-4 w-5/6 skeleton" />
          <div className="h-4 w-4/6 skeleton" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !article) {
    return (
      <div className="py-20 px-6 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-oxblood-subtle text-oxblood flex items-center justify-center mx-auto text-xl font-bold">
          ✕
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">Error loading article</h1>
        <p className="text-sm text-muted">{error}</p>
        <button
          onClick={() => { setError(null); window.location.reload(); }}
          className="px-4 py-2 rounded-sharp bg-ink text-surface font-semibold text-xs hover:bg-gold hover:text-ink transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Topic not generated yet
  if (!article && !generating) {
    return (
      <div className="py-20 px-6 max-w-md mx-auto text-center space-y-6">
        <p className="dateline">Setting type…</p>
        <div className="plate-rule" />
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-ink capitalize">
            {slug.replace(/-/g, " ")}
          </h1>
          <p className="font-serif italic text-muted leading-relaxed">
            This entry has not yet been composed. Our autonomous epistemic agents will research the literature, cross-validate citations, and build verified claim structures.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full py-3 px-4 rounded-sharp bg-ink text-surface font-semibold text-sm hover:bg-gold hover:text-ink transition-colors"
        >
          Generate verified article
        </button>
      </div>
    );
  }

  // Generating in progress
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
      <div className="py-16 px-6 max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold font-medium">
            Autonomous pipeline active
          </span>
          <h1 className="font-display text-3xl font-bold text-ink capitalize">
            {slug.replace(/-/g, " ")}
          </h1>
        </div>
        <GenerationBar
          entry={progressEntry}
          onRetry={() => handleGenerate()}
          onDismiss={() => {}}
          showWatchLive={false}
        />
        <EpisodeFeed events={agentEvents} />
      </div>
    );
  }

  if (!article) return null;

  const category = article.categories?.[0] || "Research Entry";
  const title = article.title || slug.replace(/-/g, " ");
  const abstract = article.abstract || "";
  const showCalc = /quantum|qubit|hilbert|comput|physic|relativ|transformer|crispr/i.test(
    `${slug} ${category} ${title}`
  );

  return (
    <div className="py-10 px-6 sm:px-10 w-full xl:grid xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-10 xl:items-start transition-all duration-300">
      {/* TOC rail anchored to the outer left on desktop xl+ */}
      <ArticleContents variant="rail" blocks={contentBlocks as any} />

      <div className="min-w-0 w-full">
        <ArticleContents variant="bar" blocks={contentBlocks as any} />
        <div className={`${containerClass("prose")} transition-all duration-300`}>
          <section ref={readingRef}>
            {/* Masthead */}
            <PlateHead
              folioLeft={category}
              folioRight={article.citations?.length ? `${article.citations.length} sources` : "Research entry"}
              title={title}
              deck={abstract || undefined}
            >
          {/* Quick Actions */}
          <div className="flex items-center gap-4 pt-3 text-xs font-medium flex-wrap">
            {tourSteps.length > 0 && (
              <button
                onClick={() => setTourOpen(true)}
                className="text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4 hover:text-gold transition-colors cursor-pointer"
                title="Guided reading tour"
              >
                Take the tour
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={generating}
              className="text-muted hover:text-ink underline decoration-rule hover:decoration-gold underline-offset-4 transition-colors cursor-pointer disabled:opacity-40"
              title="Refresh with live web search"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => handleExport("markdown")}
              className="text-muted hover:text-ink underline decoration-rule hover:decoration-gold underline-offset-4 transition-colors cursor-pointer"
              title="Export as Markdown"
            >
              Markdown
            </button>
            <button
              onClick={() => handleExport("json")}
              className="text-muted hover:text-ink underline decoration-rule hover:decoration-gold underline-offset-4 transition-colors cursor-pointer"
              title="Export JSON"
            >
              JSON
            </button>
          </div>
        </PlateHead>

        {/* Hero figure */}
        {heroMedia && (
          <div className="mt-8">
            <MediaImage
              src={(heroMedia as any).src}
              caption={(heroMedia as any).caption}
              source={(heroMedia as any).source}
              prompt={(heroMedia as any).prompt}
            />
          </div>
        )}

        {/* Reading flow: sections, figures, diagrams, chronology */}
        <div className="py-8">
          {contentBlocks.length > 0 ? (
            <MagazineFlow
              blocks={contentBlocks as any}
              slug={slug}
              claimsIndex={claimsIndex}
              activeClaimId={selectedClaim?.id ?? null}
              onClaimSelect={handleChipSelect}
            />
          ) : (
            <p className="font-sans text-sm text-muted">
              Full article body is still being synthesized for this entry. Claims and citations below reflect verified pipeline output.
            </p>
          )}

          {/* Infobox — only when the article carries real metadata */}
          {((article.citations?.length ?? 0) > 0 || (article.categories?.length ?? 0) > 0) && (
            <InfoboxCard
              title="Key facts"
              facts={[
                ...(article.citations?.length
                  ? [{ label: "Citations", value: `${article.citations.length} verified` }]
                  : []),
                ...(article.categories?.length
                  ? [{ label: "Domain", value: article.categories[0] }]
                  : []),
                ...((article as any).updated_at
                  ? [{ label: "Updated", value: new Date((article as any).updated_at).toLocaleDateString() }]
                  : []),
              ]}
            />
          )}
        </div>

        <div className="fleuron" aria-hidden>❦</div>

        {/* Section 2: Empirical Propositions */}
        {epistemicClaims.length > 0 ? (
          <GroupedClaimsList
            claims={epistemicClaims}
            onSelectClaim={(c) => setSelectedClaim(c)}
            activeClaimId={selectedClaim?.id ?? null}
          />
        ) : (
          <div className="border border-rule rounded-sharp bg-surface-elevated p-6 font-serif italic text-muted">
            No verified claims recorded for this entry yet.
          </div>
        )}

        {/* Section 3: Interactive Formula Simulator — only for quantitative topics */}
        {showCalc && (
          <>
            <div className="fleuron" aria-hidden>❦</div>
            <InteractiveCalcCard />
          </>
        )}

        {/* Check yourself — auto-quiz drawn from this article's claims */}
        <QuizCard claims={epistemicClaims} />

        {/* Section 4: Primary Literature Bibliography */}
        <div className="py-8">
          <h2 className="font-display text-2xl font-bold text-ink mb-4">
            Primary literature
            {article.citations?.length ? (
              <span className="font-mono text-sm font-normal text-subtle tabular-nums"> ({article.citations.length})</span>
            ) : null}
          </h2>
          {article.citations && article.citations.length > 0 ? (
            <ol className="ledger">
              {article.citations.map((cite, idx) => (
                <li key={idx} className="ledger-row">
                  <span className="index-numeral">[{idx + 1}]</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[15px] text-ink">{cite.title || "Primary source"}</span>
                    {cite.url && (
                      <a
                        href={cite.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[13px] text-muted hover:text-gold truncate mt-0.5 transition-colors"
                      >
                        {cite.url}
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="font-serif italic text-muted">No citations recorded yet.</p>
          )}
        </div>

        {/* Related entries */}
        {article.crossrefs && article.crossrefs.length > 0 && (
          <div className="py-8">
            <h2 className="font-display text-2xl font-bold text-ink mb-4">Related entries</h2>
            <div className="ledger">
              {article.crossrefs.map((cr: any, idx: number) => (
                <Link key={cr.id || idx} href={`/article/${cr.id}`} className="ledger-row group">
                  <span className="index-numeral">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-lg font-semibold text-ink group-hover:text-gold transition-colors truncate">
                      {cr.title || cr.id}
                    </span>
                    {cr.relationship && (
                      <span className="block text-xs text-muted truncate mt-0.5">{cr.relationship}</span>
                    )}
                  </span>
                  <span className="text-subtle group-hover:text-gold transition-colors shrink-0" aria-hidden>›</span>
                </Link>
              ))}
            </div>
          </div>
        )}
          </section>
        </div>
      </div>

      {/* Claim detail rail — docks right, article stays visible beside it */}
      <ClaimDetailRail
        claim={selectedClaim}
        allClaims={epistemicClaims}
        edges={graphEdges}
        gaps={articleGaps}
        versionDiffs={versionDiffs}
        elsewhere={elsewhere}
        onNavigate={(c) => setSelectedClaim(c)}
        onClose={() => setSelectedClaim(null)}
      />

      {tourOpen && tourSteps.length > 0 && (
        <ArticleTour steps={tourSteps} scrollRoot={readingRef} onClose={() => setTourOpen(false)} />
      )}
    </div>
  );
}
