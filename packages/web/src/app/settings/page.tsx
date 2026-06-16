"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../components/ThemeProvider";
import { BASE } from "@/lib/api";
import {
  IconUser, IconLightning, IconPalette, IconLogout,
  IconCheck, IconX
} from "../components/Icons";

interface QuotaInfo {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  tier: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading, token, logout } = useAuth();
  const { resolved, toggle, setTheme } = useTheme();
  const router = useRouter();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatar(user.avatar || "");
    }
  }, [user]);

  const fetchQuota = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/quota`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) setQuota(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`${BASE}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, avatar: avatar || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  if (authLoading || !user) return null;

  const tierColors: Record<string, { bg: string; text: string }> = {
    free: { bg: "var(--border-light)", text: "var(--subtle)" },
    pro: { bg: "var(--accent-bg)", text: "var(--accent)" },
    enterprise: { bg: "#fef3c7", text: "#92400e" },
    admin: { bg: "#ede9fe", text: "#6d28d9" },
  };

  const tierStyle = tierColors[user.subscriptionTier] || tierColors.free;

  return (
    <PageLayout noFooter>
      <div className="max-w-2xl mx-auto w-full px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>Settings</h1>

        {/* ── Profile ── */}
        <section className="glass-card-static p-6 space-y-5">
          <div className="flex items-center gap-2">
            <IconUser size={18} />
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Profile</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>EMAIL</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="input text-sm w-full opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="input text-sm w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>AVATAR URL</label>
              <input
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="input text-sm w-full"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--red)" }}>
                <IconX size={14} /> {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-sm" style={{ color: "var(--green)" }}>
                  <IconCheck size={14} /> Saved
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ── Subscription ── */}
        <section className="glass-card-static p-6 space-y-4">
          <div className="flex items-center gap-2">
            <IconLightning size={18} />
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Subscription</h2>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full"
              style={{ background: tierStyle.bg, color: tierStyle.text }}
            >
              {user.subscriptionTier}
            </span>
            {user.subscriptionTier === "free" && (
              <Link
                href="/pricing"
                className="text-xs font-medium underline underline-offset-2"
                style={{ color: "var(--accent)" }}
               
              >
                Upgrade plan
              </Link>
            )}
            {user.subscriptionTier === "pro" && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${BASE}/stripe/portal`, {
                      headers: { authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch {}
                }}
                className="text-xs font-medium underline underline-offset-2"
                style={{ color: "var(--muted)" }}
              >
                Manage billing
              </button>
            )}
          </div>

          {quota && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                <span>Generation usage</span>
                <span>{quota.used} / {quota.limit === 999999 ? "∞" : quota.limit}</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: "var(--border-light)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (quota.used / (quota.limit === 999999 ? 1 : quota.limit)) * 100)}%`,
                    background: quota.remaining > 0 ? "var(--accent)" : "var(--red)",
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--subtle)" }}>
                {quota.remaining > 0
                  ? `${quota.remaining} generations remaining this month`
                  : "Limit reached. Upgrade to generate more."}
              </p>
            </div>
          )}
        </section>

        {/* ── Preferences ── */}
        <section className="glass-card-static p-6 space-y-4">
          <div className="flex items-center gap-2">
            <IconPalette size={18} />
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Preferences</h2>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>THEME</label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="btn btn-sm capitalize"
                  style={{
                    background: resolved === t || (!t.startsWith(resolved) && t === "system") ? "var(--accent)" : "var(--border-light)",
                    color: resolved === t || (!t.startsWith(resolved) && t === "system") ? "white" : "var(--muted)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sign Out ── */}
        <div className="pt-2">
          <button onClick={() => { logout(); router.push("/"); }} className="btn btn-sm flex items-center gap-1.5" style={{ color: "var(--red)" }}>
            <IconLogout size={14} /> Sign Out
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
