"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateArticle, fetchQuota } from "@/lib/api";
import type { QuotaInfo } from "@/lib/api";
import PageLayout from "../../components/PageLayout";
import { IconAlert, IconLightning } from "../../components/Icons";

export default function NewArticlePage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("");
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [quotaLoaded, setQuotaLoaded] = useState(false);

  useEffect(() => {
    fetchQuota().then((q) => {
      setQuota(q);
      setQuotaLoaded(true);
    }).catch(() => setQuotaLoaded(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!clean) return;
    setStatus("queued");
    const result = await generateArticle(clean);
    router.push(`/article/${clean}`);
  }

  const atLimit = quotaLoaded && quota && quota.remaining <= 0;

  if (atLimit) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md text-center glass-card-static p-8" style={{ background: "var(--cream)" }}>
            <div className="mb-4 flex justify-center"><IconAlert size={32} /></div>
            <h1 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>Generation Limit Reached</h1>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              Your {quota.tier} plan allows {quota.limit} article generations. Upgrade to create more.
            </p>
            <Link href="/pricing" className="btn btn-primary btn-lg">Upgrade Plan</Link>
            <div className="mt-4">
              <Link href="/articles" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
                ← Browse Articles
              </Link>
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>Generate Article</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Enter a topic. The AI will research, outline, and write a full article.</p>
            {quota && (
              <p className="text-xs mt-2" style={{ color: "var(--subtle)" }}>
                {quota.remaining} of {quota.limit} generations remaining ({quota.tier})
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink)" }}>Topic Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="quantum-computing"
                className="w-full input"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!slug.trim() || !!status}
              className="btn btn-primary btn-lg w-full"
            >
              {status ? "Generating..." : <><IconLightning size={16} /> Generate Article</>}
            </button>
          </form>

          <div className="glass-card-static p-5" style={{ background: "var(--cream)" }}>
            <h3 className="text-xs font-medium mb-3" style={{ color: "var(--ink)" }}>TIPS</h3>
            <ul className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
              <li>• Use hyphens for multi-word: <code className="glass-card-static px-2 py-0.5 text-xs">machine-learning</code></li>
              <li>• Be specific: prefer <code className="glass-card-static px-2 py-0.5 text-xs">quantum-entanglement</code> over <code className="glass-card-static px-2 py-0.5 text-xs">physics</code></li>
              <li>• Research phase uses web search for primary sources</li>
              <li>• Articles stored in SQLite + versioned in Git</li>
            </ul>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
