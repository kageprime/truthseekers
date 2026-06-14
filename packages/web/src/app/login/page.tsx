"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TruthseekersLogo from "../components/TruthseekersLogo";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await login(email);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (result.user.onboarded) {
      router.push("/chat");
    } else {
      router.push("/onboarding");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--warm)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TruthseekersLogo />
          </div>
          <h1 className="pixel text-lg" style={{ color: "var(--ink)" }}>WELCOME</h1>
          <p className="text-sm mt-2" style={{ color: "#5f6368" }}>Enter your email to sign in</p>
        </div>

        {sent ? (
          <div className="text-center p-8 rounded-2xl border-2 border-black" style={{ background: "white", boxShadow: "6px 6px 0px var(--ink)" }}>
            <div className="text-3xl mb-4">✉️</div>
            <p className="font-medium mb-2" style={{ color: "var(--ink)" }}>Check your email</p>
            <p className="text-sm" style={{ color: "#5f6368" }}>
              We sent a magic link to <strong>{email}</strong>
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 pixel text-[9px] px-4 py-3 min-h-[44px] border-2 border-black"
              style={{ background: "white", color: "var(--ink)" }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block pixel text-[9px] mb-1.5" style={{ color: "var(--ink)" }}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 min-h-[44px] border-2 border-black text-base rounded-xl"
                style={{ background: "white", color: "var(--ink)", outline: "none" }}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={!email.includes("@")}
              className="w-full pixel text-[9px] px-4 py-3 min-h-[44px] border-2 border-black disabled:opacity-40"
              style={{ background: email.includes("@") ? "var(--orange)" : "#e0e0e0", color: email.includes("@") ? "white" : "#999", boxShadow: "4px 4px 0px var(--ink)" }}
            >
              CONTINUE →
            </button>
          </form>
        )}

        <p className="text-center text-xs mt-6" style={{ color: "#9ca3af" }}>
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
