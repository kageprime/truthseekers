"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BASE } from "@/lib/constants";
import { safeRedirect } from "@/lib/safe-url";
import { useAuth } from "../hooks";
import { storeToken, clearToken, getStoredToken } from "../components/AuthProvider";
import { useLoginEmail, useVerifyOTP, useRegisterPassword, useLoginPassword, useSignup, useActivateSignup, useOnboard, useFetchMe } from "../hooks";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [mode, setMode] = useState<"code" | "password" | "signup">("code");
  const [showSetPw, setShowSetPw] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { mutate: loginMutate } = useLoginEmail();
  const { mutate: verifyMutate } = useVerifyOTP();
  const { mutate: registerPwMutate } = useRegisterPassword();
  const { mutate: loginPwMutate } = useLoginPassword();
  const { mutate: signupMutate } = useSignup();
  const { mutate: activateMutate } = useActivateSignup();
  const { mutate: fetchMeMutate } = useFetchMe();

  // ponytail: single post-login destination — honor ?redirect= (bounce-back
  // from a protected page), else home. replace (not push) so back-button
  // never returns to /login.
  const redirectAfterLogin = (onboarded?: boolean) => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    router.replace(onboarded ? safeRedirect(params.get("redirect")) : "/onboarding");
  };

  const handleToken = (data: { token?: string; user?: { onboarded?: boolean }; error?: string }) => {
    if (data.error) { setError(data.error); setLoading(false); return false; }
    if (data.token) {
      storeToken(data.token);
      redirectAfterLogin(data.user?.onboarded);
      return true;
    }
    return false;
  };

  useEffect(() => {
    // ponytail: honor ?redirect= (e.g. middleware bounced /chat/new here) —
    // hardcoded "/" dropped it and logged-in users landed on the homepage.
    if (!authLoading && user) {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      router.replace(safeRedirect(params.get("redirect")));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      const token = hash.slice(7);
      storeToken(token);
      fetchMeMutate(token).then((u) => {
        redirectAfterLogin(u?.onboarded ?? true);
      }).catch(() => router.replace("/"));
      window.location.hash = "";
    }
  }, [router, fetchMeMutate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = (await loginMutate(email)) ?? {};
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.token) {
        storeToken(data.token);
        redirectAfterLogin(data.user?.onboarded);
      } else if (data.sent) {
        setSent(true);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = (await verifyMutate({ email, code })) ?? {};
      handleToken(data);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = (await loginPwMutate({ email, password })) ?? {};
      handleToken(data);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = (await registerPwMutate({ email, code: regCode, password: regPassword })) ?? {};
      handleToken(data);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = (await signupMutate({ username, email, password })) ?? {};
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.sent) setSent(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = (await activateMutate({ email, code })) ?? {};
      handleToken(data);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleOAuth = (provider: "github" | "google") => {
    window.location.href = `${BASE}/auth/${provider}`;
  };

  return (
    <div className="max-w-[440px] mx-auto">
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">TruthSeekers • Access</div>
        <h1 className="r-h1 mt-1" style={{ fontSize: 28 }}>Sign in</h1>
        <p className="text-[11px] mt-1" style={{ color: "#555" }}>
          Research, write, verify — on any topic.
        </p>
      </div>
      <div className="border-[3px] bg-[#efe9d5]" style={{ borderStyle: "outset", borderColor: "#fff8e0 #8a7f68 #8a7f68 #fff8e0", boxShadow: "4px 4px 0 rgba(0,0,0,.35)" }}>
        <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1">TruthSeekers — Sign in</div>
        <div className="p-4">
        {sent ? (
          /* Email sent state */
          <div>
            <div className="bg-white border-[2px] p-4 text-center" style={{ borderStyle: "inset", borderColor: "#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
              <h2 className="text-[13px] font-bold mb-2 text-[#0a2a5e]">Check your email</h2>
              <p className="text-[12px] mb-4" style={{ color: "#555" }}>
                {mode === "signup" ? (<>Enter the code to activate <strong>{email}</strong></>) : (<>We sent a 6-digit code to <strong>{email}</strong></>)}
              </p>
              <form onSubmit={mode === "signup" ? handleActivateSubmit : handleCodeSubmit} className="space-y-3 mb-4">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                  aria-label="6-digit login code"
                  className="w-full px-4 py-2.5 text-[13px] text-center bg-white text-black"
                  style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080", letterSpacing: "0.5em" }}
                />
                {error && (
                  <div className="text-[11px] bg-[#fde8e8] border border-[#a33] text-[#a33] p-1.5">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={code.length !== 6 || loading}
                  className="w-full py-2 px-5 text-[12px] font-bold bg-[#0a2a5e] text-[#c9a227] border-[2px] disabled:opacity-40"
                  style={{ borderStyle: "outset", borderColor: "#fff #404040 #404040 #fff" }}
                >
                  {loading ? "Verifying..." : mode === "signup" ? "Activate account" : "Verify code"}
                </button>
              </form>
              <button onClick={() => { setSent(false); setCode(""); }} className="text-[11px] font-medium underline underline-offset-2 cursor-pointer text-[#0a2a5e]" style={{ background: "none", border: "none" }}>
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <div>
                {/* OAuth buttons */}
                <div className="space-y-2 mb-4">
                  <button
                    onClick={() => handleOAuth("github")}
                    className="r-btn w-full flex items-center justify-center gap-2 py-2 text-[12px] font-bold"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                    Continue with GitHub
                  </button>
                  <button
                    onClick={() => handleOAuth("google")}
                    className="r-btn w-full flex items-center justify-center gap-2 py-2 text-[12px] font-bold"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 h-[2px] bg-[#8a7f68]" />
                  <span className="text-[10px] font-bold" style={{ color: "#8a7f68" }}>OR</span>
                  <div className="flex-1 h-[2px] bg-[#8a7f68]" />
                </div>

                {/* Code / password / signup tabs */}
                <div className="flex gap-1 mb-4 p-1 bg-[#d4d0c8] border-[2px]" style={{ borderStyle: "inset", borderColor: "#808080 #fff #fff #808080" }} role="tablist" aria-label="Sign-in method">
                  {(["code", "password", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => { setMode(m); setError(""); }}
                      className="flex-1 py-1.5 text-[11px] font-bold border-[2px]"
                      style={{ borderStyle: mode === m ? "inset" : "outset", borderColor: mode === m ? "#808080 #fff #fff #808080" : "#fff #404040 #404040 #fff", background: mode === m ? "#efe9d5" : "#d4d0c8", color: "#000" }}
                    >
                      {m === "code" ? "Login code" : m === "password" ? "Password" : "Sign up"}
                    </button>
                  ))}
                </div>

                {mode === "code" ? (
                /* Email form */
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0a2a5e" }} htmlFor="login-email">Email</label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full px-3 py-2 text-[12px] bg-white text-black"
                        style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                      />
                  </div>
                  {error && (
                    <div className="text-[11px] bg-[#fde8e8] border border-[#a33] text-[#a33] p-1.5">{error}</div>
                  )}
                  <button
                    type="submit"
                    disabled={!email.includes("@") || loading}
                    className="w-full py-2 px-5 text-[12px] font-bold bg-[#0a2a5e] text-[#c9a227] border-[2px] disabled:opacity-40"
                    style={{ borderStyle: "outset", borderColor: "#fff #404040 #404040 #fff" }}
                  >
                      <span className="flex items-center justify-center gap-2">
                        {loading ? "Sending..." : "Send login code"}
                    </span>
                  </button>
                </form>
                ) : mode === "password" ? (
                /* Password form */
                <div className="space-y-3">
                  <form onSubmit={handlePasswordSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0a2a5e" }} htmlFor="pw-email">Email</label>
                      <input
                        id="pw-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full px-3 py-2 text-[12px] bg-white text-black"
                        style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0a2a5e" }} htmlFor="pw-pass">Password</label>
                      <input
                        id="pw-pass"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-3 py-2 text-[12px] bg-white text-black"
                        style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                      />
                    </div>
                    {error && (
                      <div className="text-[11px] bg-[#fde8e8] border border-[#a33] text-[#a33] p-1.5">{error}</div>
                    )}
                    <button
                      type="submit"
                      disabled={!email.includes("@") || !password || loading}
                      className="w-full py-2 px-5 text-[12px] font-bold bg-[#0a2a5e] text-[#c9a227] border-[2px] disabled:opacity-40"
                      style={{ borderStyle: "outset", borderColor: "#fff #404040 #404040 #fff" }}
                    >
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                  </form>
                  {!showSetPw ? (
                    <button onClick={() => setShowSetPw(true)} className="w-full text-[11px] font-medium underline underline-offset-2 cursor-pointer text-[#0a2a5e]" style={{ background: "none", border: "none" }}>
                      Set a password with a login code
                    </button>
                  ) : (
                    <form onSubmit={handlePasswordRegister} className="space-y-3 pt-2 border-t-[2px] border-[#8a7f68]">
                      <p className="text-[11px]" style={{ color: "#555" }}>Get a code via the Login code tab, then set your password here.</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={regCode}
                        onChange={(e) => setRegCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit code"
                        required
                        aria-label="6-digit registration code"
                        className="w-full px-3 py-2 text-[12px] text-center bg-white text-black"
                        style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080", letterSpacing: "0.4em" }}
                      />
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="New password (8+ characters)"
                        required
                        minLength={8}
                        aria-label="New password"
                        className="w-full px-3 py-2 text-[12px] bg-white text-black"
                        style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                      />
                      <button
                        type="submit"
                        disabled={regCode.length !== 6 || regPassword.length < 8 || loading}
                        className="r-btn w-full py-2 text-[12px] font-bold disabled:opacity-40"
                      >
                        {loading ? "Saving..." : "Set password"}
                      </button>
                    </form>
                  )}
                </div>
                ) : (
                /* Signup form */
                <form onSubmit={handleSignupSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0a2a5e" }} htmlFor="su-user">Username</label>
                    <input
                      id="su-user"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="yourname"
                      required
                      minLength={3}
                      maxLength={30}
                      className="w-full px-3 py-2 text-[12px] bg-white text-black"
                      style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0a2a5e" }} htmlFor="su-email">Email</label>
                      <input
                        id="su-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-3 py-2 text-[12px] bg-white text-black"
                      style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0a2a5e" }} htmlFor="su-pass">Password</label>
                    <input
                      id="su-pass"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8+ characters"
                      required
                      minLength={8}
                      className="w-full px-3 py-2 text-[12px] bg-white text-black"
                      style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
                    />
                  </div>
                  {error && (
                    <div className="text-[11px] bg-[#fde8e8] border border-[#a33] text-[#a33] p-1.5">{error}</div>
                  )}
                  <button
                    type="submit"
                    disabled={username.length < 3 || !email.includes("@") || password.length < 8 || loading}
                    className="w-full py-2 px-5 text-[12px] font-bold bg-[#0a2a5e] text-[#c9a227] border-[2px] disabled:opacity-40"
                    style={{ borderStyle: "outset", borderColor: "#fff #404040 #404040 #fff" }}
                  >
                    {loading ? "Creating account..." : "Create account"}
                  </button>
                </form>
                )}

                <p className="text-center text-[10px] mt-4" style={{ color: "#8a7f68" }}>
                  By continuing, you agree to our Terms of Service
                </p>

                <div className="text-center mt-3 space-y-2">
                  <Link href="/articles" className="text-[11px] font-bold text-[#0a2a5e] underline">
                    Browse without signing in →
                  </Link>
                  {IS_MOCK && (
                    <div>
                      <button
                        onClick={() => {
                          storeToken("truthseekers_mock");
                          redirectAfterLogin(true);
                        }}
                        className="r-btn text-[11px] font-bold px-3 py-1"
                      >
                        Continue as guest
                      </button>
                    </div>
                  )}
                </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
