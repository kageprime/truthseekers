"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onboard } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

// ponytail: one step — backend only persists the onboarded flag.
// Skipping still records it so login never bounces back here.
export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?redirect=/onboarding");
  }, [user, loading, router]);

  const finish = async () => {
    setError("");
    setBusy(true);
    const ok = await onboard();
    setBusy(false);
    if (ok) router.replace("/chat");
    else setError("Couldn't save — check your connection and try again.");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-paper px-5 py-24 text-ink">
        <p role="status" className="font-mono text-[11px] uppercase">
          Loading…
        </p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader kicker="Welcome to the reading room" />
      <div className="mx-auto max-w-[1400px] border-x border-ink/10">
        <section className="px-5 py-14 md:px-12 md:py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Onboarding / 01</p>
          <h1 className="mt-4 max-w-2xl font-sans text-6xl font-bold leading-[.86] tracking-[-.08em] md:text-8xl">
            What should<br />
            we call <span className="text-coral">you?</span>
          </h1>
          <div className="mt-10 max-w-xl space-y-4">
            <div>
              <label htmlFor="name" className="font-mono text-[10px] uppercase text-muted">
                Display name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Curious Reader"
                autoComplete="nickname"
                className="w-full border border-ink/25 bg-transparent px-4 py-3 font-serif text-lg outline-none placeholder:text-muted focus:border-coral"
              />
            </div>
            {error && (
              <p role="alert" className="font-mono text-[11px] uppercase text-coral">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              onClick={finish}
              className="w-full bg-coral px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition hover:bg-ink hover:text-paper disabled:opacity-40"
            >
              {busy ? "Saving…" : name.trim() ? "Begin reading" : "Skip for now"}
            </button>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
