"use client";

import { useState, useRef, useCallback, useMemo } from "react";
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
} from "../../hooks";
import GenerationBar from "../../components/GenerationBar";
import EpisodeFeed from "../../components/EpisodeFeed";
import type { AgentEvent } from "../../components/ProcessViewer";
import type { Article } from "@encarta/core";
import { useUiMode } from "../../context/UiModeContext";
import InfoboxCard from "../../components/article/InfoboxCard";
import GroupedClaimsList, { type ClaimItem } from "../../components/article/GroupedClaimsList";
import ClaimDetailModal from "../../components/article/ClaimDetailModal";
import InteractiveCalcCard from "../../components/article/InteractiveCalcCard";

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

  const { widthMode } = useUiMode();
  const { data: epistemic } = useArticleEpistemic(generating ? undefined : slug);

  const epistemicClaims = useMemo<ClaimItem[]>(() => {
    const list = (epistemic as any)?.claims;
    if (Array.isArray(list) && list.length > 0) {
      return list.map((c: any) => ({
        id: c.id,
        text: c.text,
        status: c.status || "verified",
        derived_confidence: c.derived_confidence ?? 0.95,
        source_title: c.source_title || "Verified Primary Source",
        contradiction_level: c.confidence_vector?.contradiction_level,
        confidence_vector: c.confidence_vector,
        evidence: c.evidence,
      }));
    }
    return [];
  }, [epistemic]);

  const { data: quota } = useQuota();
  const { mutate: generateArticle } = useGenerateArticle();
  const { mutate: refreshArticle } = useRefreshArticle();
  const { data: status } = useArticleStatus(generating ? slug : undefined);
  const trackedRef = useRef(false);
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
        <div className="font-display text-4xl text-gold">❖</div>
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

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <section className={`${containerClass} mx-auto transition-all duration-300`}>
        {/* Masthead */}
        <div className="plate-head">
          <div className="plate-folio">
            <span>{category}</span>
            <span>
              {article.citations?.length
                ? `${article.citations.length} sources`
                : "Research entry"}
            </span>
          </div>
          <h1 className="plate-title">{title}</h1>
          {abstract && <p className="plate-deck">{abstract}</p>}
          <div className="plate-controls">
            <div className="plate-byline">
              <span>Veritas pipeline</span>
              <span className="plate-sep">·</span>
              <span>Verified literature</span>
            </div>
          </div>
          <div className="plate-rule" />

          {/* Quick Actions */}
          <div className="flex items-center gap-4 pt-3 text-xs font-medium">
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
        </div>

        {/* Section 1: Introduction & Body Text */}
        <div className="py-8">
          <h2 className="font-display text-2xl font-bold text-ink mb-4">Overview</h2>
            <div className="t-body text-ink-secondary">
              {article.sections && article.sections.length > 0 ? (
                article.sections.map((sec, idx) => (
                  <div key={idx} className="mb-5">
                    {sec.title && idx > 0 && (
                      <h3 className="font-display font-bold text-xl text-ink mt-8 mb-3">
                        {sec.title}
                      </h3>
                    )}
                    <p className={idx === 0 ? "drop-cap" : undefined}>
                      {sec.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="font-sans text-sm text-muted">
                  Full article body is still being synthesized for this entry. Claims and citations below reflect verified pipeline output.
                </p>
              )}
            </div>

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
      </section>

      {/* Claim Detail Modal */}
      <ClaimDetailModal
        claim={selectedClaim}
        onClose={() => setSelectedClaim(null)}
      />
    </div>
  );
}
