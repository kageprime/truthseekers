"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BASE } from "@/lib/constants";
import { IconSend, IconUser } from "../components/Icons";
import { storeToken, useAuth } from "../hooks/useAuth";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      const token = hash.slice(7);
      storeToken(token);
      fetch(`${BASE}/auth/me`, { headers: { authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.user?.onboarded) router.replace("/");
          else router.replace("/onboarding");
        })
        .catch(() => router.replace("/"));
      window.location.hash = "";
    }
  }, [router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); setLoading(false); return; }

      if (data.token) {
        storeToken(data.token);
        if (data.user?.onboarded) router.push("/");
        else router.push("/onboarding");
      } else if (data.sent) {
        setSent(true);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleOAuth = (provider: "github" | "google") => {
    window.location.href = `${BASE}/auth/${provider}`;
  };

  return (
    <main className="min-h-dvh flex flex-col md:flex-row relative">
      {/* ── Left: Editorial Brand Tower ── */}
      <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center relative overflow-hidden p-12" style={{ background: "color-mix(in srgb, var(--gold-bg) 40%, var(--surface))" }}>
        {/* Decorative letter */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(20rem, 50vw, 45rem)",
            fontWeight: 900,
            lineHeight: 1,
            color: "var(--gold)",
            opacity: 0.06,
          }}
          aria-hidden="true"
        >
          T
        </div>

        <div className="relative z-10 text-center max-w-sm stagger-children">
          <div
            className="w-16 h-16 mx-auto mb-6 flex items-center justify-center"
            style={{
              borderRadius: "var(--radius-card-lg)",
              background: "var(--surface-glass)",
              backdropFilter: "blur(12px)",
              border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h1 className="font-display font-bold mb-3" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.02em", color: "var(--ink)" }}>
            Truthseekers
          </h1>
          <p className="font-serif text-sm italic leading-relaxed" style={{ color: "var(--muted)" }}>
            An AI-powered encyclopedia. Research, write, verify — on any topic.
          </p>
          <div className="mt-8 mx-auto" style={{ width: "2rem", height: "1px", background: "var(--rule)" }} />
          <p className="text-[11px] mt-6 leading-relaxed" style={{ color: "var(--subtle)" }}>
            Every article is researched, written, and fact-checked by AI agents before publication.
          </p>
        </div>
      </div>

      {/* ── Right: Form Card ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        {sent ? (
          /* Email sent state */
          <div className="w-full max-w-sm animate-appear">
            <div className="p-[3px]" style={{ borderRadius: "var(--radius-card-lg)", background: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
              <div
                className="p-8 text-center"
                style={{
                  borderRadius: "calc(var(--radius-card-lg) - 3px)",
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--forest) 12%, transparent)" }}>
                    <IconSend size={24} style={{ color: "var(--forest)" }} />
                  </div>
                </div>
                <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>Check your email</h2>
                <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
                  We sent a magic link to <strong>{email}</strong>
                </p>
                <button onClick={() => setSent(false)} className="text-xs font-medium underline underline-offset-2 cursor-pointer" style={{ color: "var(--accent)", background: "none", border: "none" }}>
                  Use a different email
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm stagger-children">
            {/* Mobile-only brand */}
            <div className="md:hidden text-center mb-8">
              <h1 className="font-display font-bold" style={{ fontSize: "1.5rem", letterSpacing: "-0.02em", color: "var(--ink)" }}>
                Truthseekers
              </h1>
              <p className="font-serif text-xs italic mt-1" style={{ color: "var(--muted)" }}>
                The AI-powered encyclopedia
              </p>
            </div>

            {/* Double-Bezel form card */}
            <div className="p-[3px]" style={{ borderRadius: "var(--radius-card-lg)", background: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
              <div
                className="p-6 sm:p-8"
                style={{
                  borderRadius: "calc(var(--radius-card-lg) - 3px)",
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-light)",
                  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 24px rgba(0,0,0,0.04)",
                }}
              >
                {/* OAuth buttons */}
                <div className="space-y-2.5 mb-6">
                  <button
                    onClick={() => handleOAuth("github")}
                    className="group w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium transition-all duration-200 cursor-pointer"
                    style={{
                      background: "#24292e",
                      color: "white",
                      border: "1px solid #1b1f23",
                      borderRadius: "var(--radius-card-lg)",
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                    Continue with GitHub
                  </button>
                  <button
                    onClick={() => handleOAuth("google")}
                    className="group w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium transition-all duration-200 cursor-pointer"
                    style={{
                      background: "white",
                      color: "var(--ink)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-card-lg)",
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <span className="text-[11px]" style={{ color: "var(--subtle)" }}>or</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                </div>

                {/* Email form */}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: "var(--muted)" }}>Email</label>
                    <div className="p-[2px]" style={{ borderRadius: "var(--radius-card-lg)", background: "color-mix(in srgb, var(--border) 12%, transparent)" }}>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full px-4 py-3 text-sm outline-none"
                        style={{
                          borderRadius: "calc(var(--radius-card-lg) - 2px)",
                          background: "var(--surface)",
                          border: "1px solid transparent",
                          color: "var(--ink)",
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "transparent"}
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--red)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={!email.includes("@") || loading}
                    className="group w-full py-3 px-5 text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-30"
                    style={{
                      borderRadius: "9999px",
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                    }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {loading ? "Sending..." : "Send magic link"}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 group-hover:translate-x-0.5"
                        style={{ background: "rgba(255,255,255,0.15)", transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </span>
                  </button>
                </form>

                <p className="text-center text-[10px] mt-6" style={{ color: "var(--subtle)" }}>
                  By continuing, you agree to our Terms of Service
                </p>

                <div className="text-center mt-4 space-y-2">
                  <Link href="/articles" className="text-[11px] font-medium hover:underline no-underline" style={{ color: "var(--accent)" }}>
                    Browse without signing in →
                  </Link>
                  {IS_MOCK && (
                    <div>
                      <button
                        onClick={() => {
                          storeToken("truthseekers_mock");
                          router.push("/");
                        }}
                        className="text-[11px] font-medium hover:underline cursor-pointer"
                        style={{ color: "var(--forest)", background: "none", border: "none" }}
                      >
                        <IconUser size={12} /> Continue as guest
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
