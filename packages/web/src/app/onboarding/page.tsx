"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import TruthseekersLogo from "../components/TruthseekersLogo";
import Spinner from "../components/Spinner";
import { IconUser, IconBook, IconChevronRight } from "../components/Icons";

const STEPS = [
  { icon: IconUser, title: "Welcome", description: "What should we call you?" },
  { icon: IconBook, title: "Your Goal", description: "How will you use Truthseekers?" },
];

const GOALS = [
  { id: "personal", label: "Personal Knowledge Base", desc: "Organize what you learn" },
  { id: "team", label: "Team Wiki", desc: "Share knowledge with your team" },
  { id: "public", label: "Public Encyclopedia", desc: "Publish for the world" },
  { id: "explore", label: "Just Exploring", desc: "Curious — no fixed plan yet" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const { user, loading: authLoading, completeOnboarding } = useAuth();
  const router = useRouter();

  const handleNext = async () => {
    if (step === 0 && name.trim()) {
      setStep(1);
    } else if (step === 1 && goal) {
      const ok = await completeOnboarding(name);
      if (ok) router.push("/chat/new?tour=true");
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <div className="text-center">
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>Please sign in first</p>
          <a href="/login" className="btn btn-primary">Sign in</a>
        </div>
      </main>
    );
  }

  const StepIcon = STEPS[step].icon;

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Decorative background — large faded illuminated initial */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(20rem, 40vw, 50rem)",
          fontWeight: 900,
          color: "var(--gold)",
          opacity: 0.04,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        V
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md stagger-children">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <TruthseekersLogo variant="icon" size={48} />
            </div>
          </div>

          <div className="plate p-8">
            {/* Editorial step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {STEPS.map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 flex items-center justify-center text-[11px] font-semibold rounded-full transition-all duration-300"
                    style={{
                      background: i <= step ? "var(--gold)" : "transparent",
                      color: i <= step ? "white" : "var(--subtle)",
                      border: i <= step ? "2px solid var(--gold)" : "2px solid var(--border)",
                    }}
                  >
                    {i < step ? "✓" : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="w-8 sm:w-14 h-px transition-all duration-300"
                      style={{ background: i < step ? "var(--gold)" : "var(--border)" }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "var(--gold-bg)" }}
                >
                  <StepIcon size={22} style={{ color: "var(--gold)" }} />
                </div>
              </div>
              <h2 className="small-caps text-sm" style={{ color: "var(--gold)" }}>{STEPS[step].title}</h2>
              <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>{STEPS[step].description}</p>
            </div>

            {step === 0 && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="input mb-6"
                onKeyDown={(e) => e.key === "Enter" && name.trim() && handleNext()}
              />
            )}

            {step === 1 && (
              <div className="space-y-2 mb-6">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className="w-full text-left px-4 py-3 min-h-[44px] rounded-md transition-all duration-200 cursor-pointer"
                    style={{
                      background: goal === g.id ? "var(--gold-bg)" : "var(--surface-elevated)",
                      color: goal === g.id ? "var(--gold)" : "var(--ink)",
                      border: goal === g.id ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                    }}
                  >
                    <div className="font-medium text-sm">{g.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: goal === g.id ? "var(--gold-soft)" : "var(--subtle)" }}>{g.desc}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              {step === 1 && (
                <button
                  onClick={() => setStep(0)}
                  className="btn btn-ghost"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={step === 0 && !name.trim() || step === 1 && !goal}
                className="btn btn-primary flex-1"
              >
                {step === 0 ? "Next" : "Start Chat"} <IconChevronRight size={14} />
              </button>
            </div>

            <div className="text-center mt-4">
              <button
                onClick={() => router.push("/chat/new")}
                className="text-xs hover:underline cursor-pointer"
                style={{ color: "var(--subtle)", background: "none", border: "none" }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
