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
  const { widthMode } = useUiMode();

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
    <div className="py-12 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-8 transition-all duration-300`}>
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold border border-blue-200">
            <span>⚡ Epistemic Pipeline</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
            Synthesize New Article
          </h1>
          <p className="font-serif text-base text-zinc-600 italic">
            Autonomous multi-agent research: literature discovery, claim extraction, evidence mapping, and formal epistemic synthesis.
          </p>
          {quota && (
            <p className="text-xs font-mono text-zinc-400">
              {quota.remaining} of {quota.limit} generations available
            </p>
          )}
        </div>

        {atLimit ? (
          <div className="p-8 rounded-2xl border border-red-200 bg-red-50/50 text-center space-y-4">
            <h2 className="text-base font-bold text-red-900">Generation Limit Reached</h2>
            <p className="text-xs text-red-700">
              Your {quota.tier} plan quota has been exhausted.
            </p>
            <Link
              href="/pricing"
              className="inline-block px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-xl no-underline"
            >
              Upgrade Plan
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Research Topic or Hypothesis
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. quantum-computing or CRISPR-gene-drives"
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500 shadow-xs transition-all"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={!topic.trim() || !!status}
              className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{status ? "Deploying Agents…" : "⚡ Synthesize Verified Article"}</span>
            </button>
          </form>
        )}

        {/* Epistemic Tips Card */}
        <div className="rounded-2xl border border-zinc-200 p-6 bg-white shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Synthesis Guidelines
          </h3>
          <ul className="space-y-2 text-xs text-zinc-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>Specificity</strong>: Prefer <code>transmon-qubit-coherence</code> over generic <code>physics</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>Autonomous Citation</strong>: The DAG pipeline queries primary literature and cross-verifies arXiv/DOI citations.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>Contestation Scrutiny</strong>: Contested assertions trigger automatic counter-evidence analysis nodes.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
