"use client";

import { useState } from "react";
import { generateArticle } from "@/lib/api";
import TruthseekersLogo from "../../components/TruthseekersLogo";

export default function NewArticlePage() {
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
    window.location.href = `/article/${clean}`;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#dfe1e5]">
        <TruthseekersLogo />
        <div className="flex items-center gap-6 text-sm text-[#5f6368]">
          <a href="/" className="hover:text-[#1a1a1a] hover:underline">Home</a>
          <a href="/queue" className="hover:text-[#1a1a1a] hover:underline">Queue</a>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-2">Generate Article</h1>
            <p className="text-[#5f6368]">Enter a topic. The AI will research, outline, and write a full article.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Topic Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="quantum-computing"
                className="w-full px-4 py-4 sm:py-3 rounded-lg border border-[#dfe1e5] focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 outline-none transition-all text-[#1a1a1a] placeholder-[#9aa0a6]"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!slug.trim() || !!status}
              className="w-full px-6 py-4 sm:py-3 bg-[#ea580c] hover:bg-[#d9530b] text-white font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status ? "Generating..." : "Generate Article"}
            </button>
          </form>

          <div className="mt-8 p-5 rounded-lg border border-[#dfe1e5] bg-[#f8f9fa]">
            <h3 className="text-xs font-semibold text-[#1a1a1a] mb-3 uppercase tracking-wide">Tips</h3>
            <ul className="space-y-2 text-sm text-[#5f6368]">
              <li>• Use hyphens for multi-word: <code className="px-2 py-0.5 bg-white rounded text-xs border border-[#dfe1e5]">machine-learning</code></li>
              <li>• Be specific: prefer <code className="px-2 py-0.5 bg-white rounded text-xs border border-[#dfe1e5]">quantum-entanglement</code> over <code className="px-2 py-0.5 bg-white rounded text-xs border border-[#dfe1e5]">physics</code></li>
              <li>• Research phase uses web search for primary sources</li>
              <li>• Articles stored in SQLite + versioned in Git</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#dadce0] py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-[#5f6368]">
          <span className="font-medium text-[#1a1a1a]">Truthseekers</span>
          <span className="text-xs">AI-powered encyclopedia</span>
        </div>
      </footer>
    </div>
  );
}
