"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  activateSignup,
  loginEmail,
  loginPassword,
  registerPassword,
  signup,
  verifyOTP,
  type LoginResponse,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

// ponytail: relative-path-only redirect — absolute URLs would be open-redirects.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function redirectParam() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("redirect");
}

type Mode = "code" | "password" | "signup";

function LoginForm() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace(safeRedirect(redirectParam()));
  }, [user, authLoading, router]);

  const afterAuth = (data: LoginResponse) => {
    if (data.error || !data.token || !data.user) {
      setError(data.error || "Login failed");
      return;
    }
    login(data.token, data.user);
    router.replace(data.user.onboarded === false ? "/onboarding" : safeRedirect(redirectParam()));
  };

  const run = async (fn: () => Promise<LoginResponse>) => {
    setError("");
    setBusy(true);
    try {
      const data = await fn();
      if (data.error) setError(data.error);
      else if (data.token) afterAuth(data);
      else if (data.sent) setSent(true);
    } catch {
      setError("Network error");
    }
    setBusy(false);
  };

  const inputCls =
    "w-full border border-ink/25 bg-transparent px-4 py-3 font-serif text-lg outline-none placeholder:text-muted focus:border-coral";
  const btnCls =
    "w-full bg-coral px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition hover:bg-ink hover:text-paper disabled:opacity-40";

  return (
    <div className="mx-auto max-w-[1400px] border-x border-ink/10">
      <section className="px-5 py-14 md:px-12 md:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Membership / Veritas</p>
        <h1 className="mt-4 font-sans text-6xl font-bold leading-[.86] tracking-[-.08em] md:text-8xl">
          Prove it&apos;s<br />
          <span className="text-coral">you.</span>
        </h1>
        <p className="mt-6 max-w-md font-serif text-xl leading-tight">
          Reading is public. Writing, chatting, and contesting require a session.
        </p>

        <div className="mt-10 flex max-w-xl gap-2" role="tablist" aria-label="Login method">
          {(["code", "password", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setSent(false);
                setError("");
              }}
              className={`border px-4 py-2 font-mono text-[10px] uppercase ${
                mode === m ? "border-ink bg-ink text-paper" : "border-ink/20 hover:border-ink"
              }`}
            >
              {m === "code" ? "Email code" : m === "password" ? "Password" : "Sign up"}
            </button>
          ))}
        </div>

        <div className="mt-8 max-w-xl space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="username" className="font-mono text-[10px] uppercase text-muted">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="curious_reader"
                autoComplete="username"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="font-mono text-[10px] uppercase text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={inputCls}
            />
          </div>

          {mode === "password" && (
            <div>
              <label htmlFor="password" className="font-mono text-[10px] uppercase text-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputCls}
              />
            </div>
          )}

          {(mode === "code" || mode === "signup") && sent && (
            <div>
              <label htmlFor="code" className="font-mono text-[10px] uppercase text-muted">
                {mode === "signup" ? "Activation code (emailed)" : "Login code (emailed)"}
              </label>
              <input
                id="code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                className={inputCls}
              />
            </div>
          )}

          {mode === "signup" && sent && (
            <div>
              <label htmlFor="reg-password" className="font-mono text-[10px] uppercase text-muted">
                Choose a password (8+ characters)
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="font-mono text-[11px] uppercase text-coral">
              {error}
            </p>
          )}

          {mode === "code" && !sent && (
            <button disabled={busy || !email} onClick={() => run(() => loginEmail(email))} className={btnCls}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          )}
          {mode === "code" && sent && (
            <button disabled={busy || !code} onClick={() => run(() => verifyOTP(email, code))} className={btnCls}>
              {busy ? "Verifying…" : "Enter"}
            </button>
          )}
          {mode === "password" && (
            <button
              disabled={busy || !email || !password}
              onClick={() => run(() => loginPassword(email, password))}
              className={btnCls}
            >
              {busy ? "Checking…" : "Log in"}
            </button>
          )}
          {mode === "signup" && !sent && (
            <button
              disabled={busy || !username || !email || password.length < 8}
              onClick={() => run(() => signup(username, email, password))}
              className={btnCls}
            >
              {busy ? "Sending…" : "Create account"}
            </button>
          )}
          {mode === "signup" && sent && (
            <div className="space-y-4">
              <button disabled={busy || !code} onClick={() => run(() => activateSignup(email, code))} className={btnCls}>
                {busy ? "Activating…" : "Activate (no password set)"}
              </button>
              <button
                disabled={busy || !code || password.length < 8}
                onClick={() => run(() => registerPassword(email, code, password))}
                className={btnCls}
              >
                {busy ? "Saving…" : "Activate + set password"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader kicker="Membership for the permanently curious" />
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mx-auto max-w-[1400px] px-5 pb-10 font-mono text-[10px] uppercase text-muted md:px-12">
        <Link href="/" className="underline">
          Back to index
        </Link>
      </p>
      <SiteFooter />
    </main>
  );
}
