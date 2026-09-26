"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuota, useGenerateArticle } from "../../hooks";
import { useUiMode } from "../../context/UiModeContext";

export default function NewArticlePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const { data: quota, loading: quotaLoading } = useQuota();
  const { mutate: generateArticle } = useGenerateArticle();
  const { widthMode, alignClass } = useUiMode();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!clean) return;
    setStatus("queued");
    await generateArticle({ slug: clean });
    router.push(`/article/${clean}`);
  }

  const atLimit = !quotaLoading && quota && quota.remaining <= 0;
  const containerClass = widthMode === "expanded" ? "max-w-3xl" : "max-w-xl";

  return (
    <div className="py-12 px-6 sm:px-10 w-full">
      <div className={`${containerClass} ${alignClass} transition-all duration-300`}>
        <div className="plate-head">
          <div className="plate-folio">
            <span>Epistemic pipeline</span>
            {quota && <span className="tabular-nums">{quota.remaining} of {quota.limit} left</span>}
          </div>
          <h1 className="plate-title">New article</h1>
          <p className="plate-deck">
            Autonomous multi-agent research: literature discovery, claim
            extraction, evidence mapping, formal synthesis.
          </p>
          <div className="plate-rule" />
        </div>

        {atLimit ? (
          <div className="border border-oxblood rounded-sharp p-8 text-center space-y-4">
            <h2 className="font-display text-xl font-bold text-oxblood">Generation limit reached</h2>
            <p className="text-sm text-muted">
              Your {quota.tier} plan quota has been exhausted.
            </p>
            <Link
              href="/pricing"
              className="category-link no-underline text-sm font-semibold"
            >
              Upgrade plan →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                Research topic or hypothesis
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. transmon-qubit-coherence"
                className="w-full bg-transparent border-b-2 border-ink pb-2 font-serif text-xl text-ink placeholder:text-subtle focus:outline-none focus:border-gold transition-colors"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={!topic.trim() || !!status}
              className="w-full py-3.5 px-4 bg-ink hover:bg-gold hover:text-ink disabled:opacity-40 text-surface font-semibold text-sm rounded-sharp transition-colors cursor-pointer"
            >
              {status ? "Deploying agents…" : "Synthesize verified article"}
            </button>
          </form>
        )}

        <div className="fleuron" aria-hidden>❦</div>

        <section className="py-4">
          <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle mb-3">
            Synthesis guidelines
          </h3>
          <ul className="space-y-2.5 text-sm text-muted">
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold">—</span>
              <span><strong className="text-ink font-medium">Specificity</strong>: prefer <code className="font-mono text-[13px]">transmon-qubit-coherence</code> over generic <code className="font-mono text-[13px]">physics</code>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold">—</span>
              <span><strong className="text-ink font-medium">Autonomous citation</strong>: the DAG pipeline queries primary literature and cross-verifies arXiv/DOI citations.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold">—</span>
              <span><strong className="text-ink font-medium">Contestation scrutiny</strong>: contested assertions trigger automatic counter-evidence analysis nodes.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
