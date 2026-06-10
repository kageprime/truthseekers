"use client";

import { useState } from "react";
import { generateArticle } from "@/lib/api";

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
    <div>
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b-3 border-black"
        style={{ background: "rgba(255,250,240,0.85)", backdropFilter: "blur(12px)", borderBottom: "3px solid var(--ink)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center text-[10px] text-white border-2 border-black shadow-[3px_3px_0_#1c1917]"
            style={{ background: "var(--orange)", fontFamily: "'Press Start 2P', monospace" }}>
            E-N
          </div>
          <a href="/" className="font-bold hidden sm:block hover:text-[#ea580c]" style={{ textDecoration: "none", color: "inherit" }}>
            Encarta-NG
          </a>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="pixel-card p-8 md:p-10 bg-white">
          <div className="flex items-center gap-4 mb-8">
            <span className="text-5xl float-anim">✨</span>
            <div>
              <h1 className="pixel text-lg" style={{ color: "var(--ink)" }}>GENERATE ARTICLE</h1>
              <div className="h-1 w-16 mt-2" style={{ background: "var(--orange)" }} />
            </div>
          </div>

          <p className="text-[#666] mb-8 leading-relaxed">
            Enter a topic below. The AI agent will research the web, create an outline, write a full article,
            and store it — all automatically. Takes 30–90 seconds.
          </p>

          <form onSubmit={handleSubmit}>
            <label className="pixel text-[10px] text-[#888] block mb-3">TOPIC SLUG</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="quantum-computing"
              className="pixel-input mb-4"
              autoFocus
            />

            <button
              type="submit"
              disabled={!slug.trim() || !!status}
              className="pixel-btn bg-[#ea580c] text-white w-full text-sm py-3"
            >
              {status ? "GENERATING..." : "GENERATE ARTICLE"}
            </button>
          </form>

          <div className="mt-8 p-5 border-3 border-black" style={{ background: "var(--cream)" }}>
            <p className="pixel text-[10px] mb-3" style={{ color: "var(--ink)" }}>TIPS</p>
            <ul className="space-y-2 text-sm text-[#555]">
              <li>• Use hyphens for multi-word: <code className="pixel-tag">machine-learning</code></li>
              <li>• Be specific: prefer <code className="pixel-tag">quantum-entanglement</code> over <code className="pixel-tag">physics</code></li>
              <li>• Research phase uses live web search for accuracy</li>
              <li>• Generated articles are stored in SQLite + versioned in Git</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t-4 border-black py-8" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="pixel text-[10px] opacity-60">ENCARTA-NG</p>
        </div>
      </footer>
    </div>
  );
}
