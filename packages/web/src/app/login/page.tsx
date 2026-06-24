"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TruthseekersLogo from "../components/TruthseekersLogo";
import { BASE } from "@/lib/constants";
import { IconSend, IconChevronRight, IconUser } from "../components/Icons";
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

  // Handle OAuth callback — token in URL hash
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(16rem, 35vw, 40rem)",
          fontWeight: 900,
          color: "var(--gold)",
          opacity: 0.04,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        E
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10 stagger-children">
          <div className="flex justify-center mb-5">
            <TruthseekersLogo variant="icon" size={48} />
          </div>
          <h1 className="t-display t-display-2 mb-2" style={{ color: "var(--ink)" }}>
            Truthseekers
          </h1>
          <p className="t-body text-sm italic" style={{ color: "var(--muted)" }}>
            The AI-powered encyclopedia.<br />Research, write, verify — on any topic.
          </p>
        </div>

        {sent ? (
          <div className="plate p-8 text-center animate-appear">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--forest-subtle)" }}>
                <IconSend size={22} style={{ color: "var(--forest)" }} />
              </div>
            </div>
            <h2 className="small-caps text-sm mb-2" style={{ color: "var(--ink)" }}>Check your email</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              We sent a magic link to <strong>{email}</strong>
            </p>
            <button onClick={() => setSent(false)} className="btn btn-ghost">
              Use a different email
            </button>
          </div>
        ) : (
          <div className="plate p-8 stagger-children">
            {/* OAuth buttons */}
            <div className="space-y-2 mb-6">
              <button
                onClick={() => handleOAuth("github")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[44px] rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{ background: "#24292e", color: "white", border: "1px solid #1b1f23" }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                Continue with GitHub
              </button>
              <button
                onClick={() => handleOAuth("google")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[44px] rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{ background: "white", color: "var(--ink)", border: "1px solid var(--border)" }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--subtle)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full input"
                />
              </div>
              {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
              <button
                type="submit"
                disabled={!email.includes("@") || loading}
                className="btn btn-primary w-full"
              >
                {loading ? "Sending..." : "Send magic link"} <IconChevronRight size={14} />
              </button>
            </form>

            <p className="text-center text-xs mt-6" style={{ color: "var(--subtle)" }}>
              By continuing, you agree to our Terms of Service
            </p>

            <div className="text-center mt-3 space-y-2">
              <Link href="/articles" className="text-xs hover:underline" style={{ color: "var(--gold)" }}>
                Browse the encyclopedia without signing in →
              </Link>
              {IS_MOCK && (
                <div>
                  <button
                    onClick={() => {
                      storeToken("truthseekers_mock");
                      router.push("/");
                    }}
                    className="text-xs font-medium hover:underline cursor-pointer"
                    style={{ color: "var(--forest)", background: "none", border: "none" }}
                  >
                    <IconUser size={12} /> Continue as guest (mock)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
