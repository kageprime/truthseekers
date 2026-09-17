"use client";

import { useMemo, useState } from "react";
import type { ClaimItem } from "./GroupedClaimsList";

interface QuizQuestion {
  claimId: string;
  text: string;
  // true = supported, false = contested
  answer: boolean;
}

// ponytail: the quiz is generated deterministically from corpus claims — no
// backend, no randomness, scored locally. Only binary verdict questions;
// unknown-status claims are skipped.
function buildQuestions(claims: ClaimItem[]): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const c of claims) {
    // Statuses arrive normalized (verified/contested/developing/unknown);
    // accept raw DB variants too since the card is shared.
    const s = (c.status || "").toLowerCase();
    if (s === "supported" || s === "verified") {
      out.push({ claimId: c.id, text: c.text, answer: true });
    } else if (["disputed", "contested", "weak", "developing"].includes(s)) {
      out.push({ claimId: c.id, text: c.text, answer: false });
    }
    if (out.length >= 5) break;
  }
  return out;
}

export default function QuizCard({ claims }: { claims: ClaimItem[] }) {
  const questions = useMemo(() => buildQuestions(claims), [claims]);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length < 2) return null;

  const q = questions[idx];

  const pick = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    if (v === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  };

  const restart = () => {
    setStarted(true);
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  };

  return (
    <section className="border border-rule rounded-sharp bg-surface-elevated p-6 sm:p-8 my-8" aria-label="Check yourself quiz">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold mb-1">
        Check yourself
      </div>
      <h3 className="font-display text-xl font-bold text-ink">Test your reading</h3>

      {!started ? (
        <div className="pt-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="font-serif italic text-sm text-muted">
            {questions.length} questions drawn from this article&rsquo;s claims. Supported or contested?
          </p>
          <button
            onClick={() => setStarted(true)}
            className="px-4 py-2 rounded-sharp bg-ink text-surface font-semibold text-xs hover:bg-gold hover:text-ink transition-colors cursor-pointer"
          >
            Start quiz
          </button>
        </div>
      ) : done ? (
        <div className="pt-4 space-y-3">
          <p className="font-display text-2xl font-bold text-ink tabular-nums">
            {score} of {questions.length}
          </p>
          <p className="font-serif italic text-sm text-muted">
            {score === questions.length
              ? "Flawless — you read like an editor."
              : score >= questions.length / 2
                ? "Solid — the disputed ones are worth a second look."
                : "Reread the contested claims — the fault lines matter most."}
          </p>
          <button
            onClick={restart}
            className="category-link no-underline text-sm font-semibold cursor-pointer"
          >
            Try again →
          </button>
        </div>
      ) : (
        <div className="pt-4 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-xs text-subtle tabular-nums">
              {idx + 1} / {questions.length}
            </span>
            <span className="font-mono text-xs text-subtle tabular-nums">Score {score}</span>
          </div>
          <p className="font-serif text-lg leading-snug text-ink">&ldquo;{q.text}&rdquo;</p>
          <div className="flex gap-3">
            {[
              { label: "Supported", value: true },
              { label: "Contested", value: false },
            ].map((opt) => {
              const isAnswer = picked !== null && opt.value === q.answer;
              const isWrongPick = picked === opt.value && opt.value !== q.answer;
              return (
                <button
                  key={opt.label}
                  onClick={() => pick(opt.value)}
                  disabled={picked !== null}
                  className={`flex-1 py-2.5 px-4 rounded-sharp border text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default ${
                    isAnswer
                      ? "border-forest bg-forest/10 text-forest"
                      : isWrongPick
                        ? "border-oxblood bg-oxblood/10 text-oxblood"
                        : "border-rule text-ink hover:border-gold"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="flex justify-end">
              <button onClick={next} className="category-link no-underline text-sm font-semibold cursor-pointer">
                {idx + 1 >= questions.length ? "See score →" : "Next →"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
