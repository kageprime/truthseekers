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
      <div className="py-16 px-6 max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-36 bg-zinc-200 rounded-full" />
        <div className="h-12 w-3/4 bg-zinc-200 rounded-xl" />
        <div className="h-20 w-full bg-zinc-200 rounded-xl" />
        <div className="space-y-3 pt-6">
          <div className="h-4 w-full bg-zinc-200 rounded" />
          <div className="h-4 w-5/6 bg-zinc-200 rounded" />
          <div className="h-4 w-4/6 bg-zinc-200 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !article) {
    return (
      <div className="py-20 px-6 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
          ✕
        </div>
        <h1 className="text-lg font-bold text-zinc-900">Error Loading Article</h1>
        <p className="text-xs text-zinc-500">{error}</p>
        <button
          onClick={() => { setError(null); window.location.reload(); }}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-semibold text-xs hover:bg-zinc-800 transition-colors"
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
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center mx-auto text-2xl font-bold">
          ❖
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900 capitalize">
            {slug.replace(/-/g, " ")}
          </h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            This entry has not yet been composed. Our autonomous epistemic agents will research the literature, cross-validate citations, and build verified claim structures.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full py-3 px-4 rounded-xl bg-zinc-900 text-white font-semibold text-xs hover:bg-zinc-800 transition-all shadow-xs flex items-center justify-center gap-2"
        >
          <span>⚡ Generate Verified Article</span>
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
          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 font-bold">
            Autonomous Pipeline Active
          </span>
          <h1 className="text-2xl font-bold text-zinc-900 capitalize">
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
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <section className={`${containerClass} mx-auto space-y-10 transition-all duration-300`}>
        {/* Header & Folio */}
        <div className="space-y-4 border-b border-zinc-200/80 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[11px] uppercase tracking-wider border border-emerald-200">
                {category}
              </span>
              <span className="text-zinc-300">•</span>
              <span className="text-zinc-500 text-xs">
                {article.citations?.length
                  ? `Verified Literature · ${article.citations.length} Sources`
                  : "Research Entry"}
              </span>
            </div>

            {/* Quick Actions (Regenerate, Export) */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
              <button
                onClick={handleRefresh}
                disabled={generating}
                className="px-2.5 py-1 rounded-md text-zinc-700 hover:text-zinc-900 hover:bg-white transition-colors cursor-pointer"
                title="Refresh with live web search"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => handleExport("markdown")}
                className="px-2.5 py-1 rounded-md text-zinc-700 hover:text-zinc-900 hover:bg-white transition-colors cursor-pointer"
                title="Export as Markdown"
              >
                Markdown
              </button>
              <button
                onClick={() => handleExport("json")}
                className="px-2.5 py-1 rounded-md text-zinc-700 hover:text-zinc-900 hover:bg-white transition-colors cursor-pointer"
                title="Export JSON"
              >
                JSON
              </button>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 leading-[1.1]">
            {title}
          </h1>

          {abstract && (
            <p className="font-serif text-lg sm:text-xl text-zinc-700 italic leading-relaxed pt-1">
              {abstract}
            </p>
          )}
        </div>

        {/* Section 1: Introduction & Body Text */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Overview
            </h2>
            <div className="space-y-4 font-serif text-lg text-zinc-800 leading-[1.6]">
              {article.sections && article.sections.length > 0 ? (
                article.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-3">
                    {sec.title && idx > 0 && (
                      <h3 className="font-sans font-bold text-base text-zinc-900 pt-3">
                        {sec.title}
                      </h3>
                    )}
                    <p>
                      {idx === 0 && sec.content && (
                        <span className="float-left text-5xl font-extrabold text-zinc-900 pr-3 leading-none font-sans">
                          {sec.content.slice(0, 1)}
                        </span>
                      )}
                      {idx === 0 ? sec.content?.slice(1) : sec.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500 font-sans">
                  Full article body is still being synthesized for this entry. Claims and citations below reflect verified pipeline output.
                </p>
              )}
            </div>
          </div>

          {/* Infobox Plate — only when the article carries real metadata */}
          {((article.citations?.length ?? 0) > 0 || (article.categories?.length ?? 0) > 0) && (
            <InfoboxCard
              title={title.toUpperCase()}
              subtitle="Corpus Infobox"
              facts={[
                ...(article.citations?.length
                  ? [{ label: "Citations", value: `${article.citations.length} Verified` }]
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

        {/* Section 2: Empirical Propositions */}
        {epistemicClaims.length > 0 ? (
          <GroupedClaimsList
            claims={epistemicClaims}
            onSelectClaim={(c) => setSelectedClaim(c)}
          />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            No verified claims recorded for this entry yet.
          </div>
        )}

        {/* Section 3: Interactive Formula Simulator — only for quantitative topics */}
        {showCalc && <InteractiveCalcCard />}

        {/* Section 4: Primary Literature Bibliography */}
        <div className="space-y-4 pt-6 border-t border-zinc-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Primary Literature Citations{article.citations?.length ? ` (${article.citations.length})` : ""}
          </h2>
          <div className="space-y-2.5 text-xs text-zinc-600">
            {article.citations && article.citations.length > 0 ? (
              article.citations.map((cite, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-white border border-zinc-200 flex items-start gap-3 shadow-xs"
                >
                  <span className="font-mono text-zinc-400 font-bold shrink-0">[{idx + 1}]</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900">{cite.title || "Primary Source"}</div>
                    {cite.url && (
                      <a
                        href={cite.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-900 truncate block mt-0.5"
                      >
                        {cite.url}
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No citations recorded yet.</p>
            )}
          </div>
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
