"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TruthseekersLogo from "../components/TruthseekersLogo";
import { useAuth } from "../hooks/useAuth";

const STEPS = [
  { emoji: "👋", title: "YOUR NAME", description: "What should we call you?" },
  { emoji: "🎯", title: "YOUR GOAL", description: "How will you use Truthseekers?" },
  { emoji: "🚀", title: "FIRST ARTICLE", description: "Let's generate your first article" },
];

const GOALS = [
  { id: "personal", label: "Personal Knowledge Base", desc: "Organize what you learn" },
  { id: "team", label: "Team Wiki", desc: "Share knowledge with your team" },
  { id: "public", label: "Public Encyclopedia", desc: "Publish for the world" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const { user, completeOnboarding } = useAuth();
  const router = useRouter();

  const handleNext = async () => {
    if (step === 0 && name.trim()) {
      setStep(1);
    } else if (step === 1 && goal) {
      setStep(2);
    } else if (step === 2) {
      if (!articleSlug.trim()) return;
      setGenerating(true);
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4097"}/articles/${encodeURIComponent(articleSlug)}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona: "veritas" }),
        });
      } catch {}
      setGenerating(false);
      setDone(true);
    }
  };

  const handleFinish = async () => {
    const ok = await completeOnboarding(name);
    if (ok) router.push("/chat");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--warm)" }}>
        <p className="text-sm" style={{ color: "#5f6368" }}>Please sign in first</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--warm)" }}>
      {/* Progress bar */}
      <div className="w-full h-1.5 flex">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 transition-all duration-500" style={{ background: i <= step ? "var(--orange)" : "#e0e0e0" }} />
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">

          {done ? (
            <div className="text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h2 className="pixel text-lg mb-2" style={{ color: "var(--ink)" }}>YOU'RE ALL SET</h2>
              <p className="text-sm mb-6" style={{ color: "#5f6368" }}>
                {articleSlug ? `"${articleSlug}" is being generated.` : "Your encyclopedia is ready."}
              </p>
              <button
                onClick={handleFinish}
                className="pixel text-[9px] px-6 py-3 min-h-[44px] border-2 border-black"
                style={{ background: "var(--orange)", color: "white", boxShadow: "4px 4px 0px var(--ink)" }}
              >
                START EXPLORING →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black p-8" style={{ background: "white", boxShadow: "6px 6px 0px var(--ink)" }}>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-8">
                {STEPS.map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-xs font-bold" style={{ background: i === step ? "var(--orange)" : i < step ? "var(--green)" : "white", color: i <= step ? "white" : "var(--ink)" }}>
                      {i < step ? "✓" : i + 1}
                    </div>
                    {i < STEPS.length - 1 && <div className="w-8 h-0.5" style={{ background: i < step ? "var(--green)" : "#e0e0e0" }} />}
                  </div>
                ))}
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl mb-2">{STEPS[step].emoji}</div>
                <h2 className="pixel text-sm" style={{ color: "var(--orange)" }}>{STEPS[step].title}</h2>
                <p className="text-sm mt-1" style={{ color: "#5f6368" }}>{STEPS[step].description}</p>
              </div>

              {step === 0 && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  className="w-full px-4 py-3 min-h-[44px] border-2 border-black text-base rounded-xl mb-4"
                  style={{ background: "var(--warm)", color: "var(--ink)", outline: "none" }}
                  onKeyDown={(e) => e.key === "Enter" && name.trim() && handleNext()}
                />
              )}

              {step === 1 && (
                <div className="space-y-2 mb-4">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => { setGoal(g.id); }}
                      className="w-full text-left px-4 py-3 min-h-[44px] border-2 border-black rounded-xl transition-all"
                      style={{ background: goal === g.id ? "var(--orange)" : "white", color: goal === g.id ? "white" : "var(--ink)" }}
                    >
                      <div className="font-medium text-sm">{g.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{g.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="mb-4">
                  <p className="text-xs mb-2" style={{ color: "#5f6368" }}>Pick a topic for your first article</p>
                  <input
                    type="text"
                    value={articleSlug}
                    onChange={(e) => setArticleSlug(e.target.value)}
                    placeholder="e.g. artificial-intelligence, ancient-rome"
                    autoFocus
                    className="w-full px-4 py-3 min-h-[44px] border-2 border-black text-base rounded-xl"
                    style={{ background: "var(--warm)", color: "var(--ink)", outline: "none" }}
                    onKeyDown={(e) => e.key === "Enter" && articleSlug.trim() && handleNext()}
                  />
                </div>
              )}

              <button
                onClick={handleNext}
                disabled={step === 0 && !name.trim() || step === 1 && !goal || step === 2 && !articleSlug.trim() || generating}
                className="w-full pixel text-[9px] px-4 py-3 min-h-[44px] border-2 border-black disabled:opacity-40 mt-2"
                style={{ background: "var(--orange)", color: "white", boxShadow: "4px 4px 0px var(--ink)" }}
              >
                {generating ? "GENERATING..." : step < 2 ? "NEXT →" : "GENERATE ARTICLE →"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
