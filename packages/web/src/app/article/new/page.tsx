"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateArticle } from "@/lib/api";
import PageLayout from "../../components/PageLayout";

export default function NewArticlePage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!clean) return;
    setStatus("queued");
    await generateArticle(clean);
    router.push(`/article/${clean}`);
  }

  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>Generate Article</h1>
            <p className="text-sm" style={{ color: "#5f6368" }}>Enter a topic. The AI will research, outline, and write a full article.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Topic Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="quantum-computing"
                className="w-full pixel-input"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!slug.trim() || !!status}
              className="btn-primary btn-lg w-full"
            >
              {status ? "Generating..." : "Generate Article"}
            </button>
          </form>

          <div className="pixel-card-sm p-5" style={{ background: "var(--cream)" }}>
            <h3 className="pixel text-[9px] mb-3" style={{ color: "var(--ink)" }}>TIPS</h3>
            <ul className="space-y-2 text-sm" style={{ color: "#5f6368" }}>
              <li>• Use hyphens for multi-word: <code className="pixel-card-sm px-2 py-0.5 text-xs" style={{ background: "white" }}>machine-learning</code></li>
              <li>• Be specific: prefer <code className="pixel-card-sm px-2 py-0.5 text-xs" style={{ background: "white" }}>quantum-entanglement</code> over <code className="pixel-card-sm px-2 py-0.5 text-xs" style={{ background: "white" }}>physics</code></li>
              <li>• Research phase uses web search for primary sources</li>
              <li>• Articles stored in SQLite + versioned in Git</li>
            </ul>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
