"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

const STEPS = [
  { icon: "👋", title: "WELCOME", description: "What should we call you?" },
  { icon: "🎯", title: "YOUR GOAL", description: "How will you use Truthseekers?" },
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
  const { user, completeOnboarding } = useAuth();
  const router = useRouter();

  const handleNext = async () => {
    if (step === 0 && name.trim()) {
      setStep(1);
    } else if (step === 1 && goal) {
      const ok = await completeOnboarding(name);
      if (ok) router.push("/chat?tour=true");
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Please sign in first</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="glass-card-static p-6 sm:p-8">
              {/* Pixel step indicator */}
              <div className="flex items-center justify-center gap-1 mb-8">
                {STEPS.map((_, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div
                      className="w-8 h-8 flex items-center justify-center text-xs font-medium border-2"
                      style={{
                        background: i === step ? "var(--accent)" : i < step ? "var(--green)" : "white",
                        color: i <= step ? "white" : "var(--ink)",
                        borderColor: "var(--ink)",
                        boxShadow: "2px 2px 0 var(--ink)",
                      }}
                    >
                      {i < step ? "✓" : i + 1}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-6 sm:w-10 h-0.5" style={{ background: i < step ? "var(--green)" : "var(--border)" }} />
                    )}
                  </div>
                ))}
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl mb-2">{STEPS[step].icon}</div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{STEPS[step].title}</h2>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{STEPS[step].description}</p>
              </div>

              {step === 0 && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  className="input mb-4"
                  onKeyDown={(e) => e.key === "Enter" && name.trim() && handleNext()}
                />
              )}

              {step === 1 && (
                <div className="space-y-2 mb-4">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => { setGoal(g.id); }}
                      className="w-full text-left px-4 py-3 min-h-[44px] border-2 border-black transition-all"
                      style={{
                        background: goal === g.id ? "var(--accent)" : "white",
                        color: goal === g.id ? "white" : "var(--ink)",
                        boxShadow: goal === g.id ? "3px 3px 0 var(--ink)" : "2px 2px 0 var(--ink)",
                      }}
                    >
                      <div className="font-medium text-sm">{g.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{g.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleNext}
                disabled={step === 0 && !name.trim() || step === 1 && !goal}
                className="btn btn-primary w-full mt-2"
              >
                {step === 1 ? "START CHAT →" : "NEXT →"}
              </button>
            </div>

        </div>
      </div>
    </main>
  );
}
