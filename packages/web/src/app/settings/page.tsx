"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ContentCard from "../components/ContentCard";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../components/ThemeProvider";
import { useQuota } from "../hooks";
import { BASE } from "@/lib/constants";
import { IconUser, IconLightning, IconPalette, IconLogout, IconCheck, IconX, IconTrash } from "../components/Icons";

export default function SettingsPage() {
  const { user, loading: authLoading, token, logout } = useAuth();
  const { resolved, setTheme } = useTheme();
  const router = useRouter();
  const { data: quota } = useQuota();
  const MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatar(user.avatar || "");
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    if (MOCK) {
      await new Promise((r) => setTimeout(r, 400));
      setSaved(true);
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
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
    <ContentCard>
      <div className="px-6 py-10 space-y-8 max-w-2xl mx-auto w-full">
        <div className="stagger-children">
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "var(--ink)" }}>Settings</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Manage your account and preferences</p>
        </div>

        {/* ── Profile ── */}
        <section className="plate p-6 stagger-children">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--gold-bg)" }}>
              <IconUser size={16} style={{ color: "var(--gold)" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Profile</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>Email</label>
              <input type="email" value={user.email} disabled className="input text-sm w-full opacity-60" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>Avatar URL</label>
              <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://example.com/avatar.jpg" className="input text-sm w-full" />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--red)" }}>
                <IconX size={14} /> {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm cursor-pointer">
                {saving ? "Saving..." : "Save changes"}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--forest)" }}>
                  <IconCheck size={12} /> Saved
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ── Subscription ── */}
        <section className="plate p-6 stagger-children">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--gold-bg)" }}>
              <IconLightning size={16} style={{ color: "var(--gold)" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Subscription</h2>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full" style={{ background: tierStyle.bg, color: tierStyle.text }}>
                {user.subscriptionTier}
              </span>
              {user.subscriptionTier === "free" && (
                <Link href="/pricing" className="text-xs font-medium underline underline-offset-2" style={{ color: "var(--gold)" }}>Upgrade plan</Link>
              )}
              {user.subscriptionTier === "pro" && (
                <button onClick={async () => { try { const res = await fetch(`${BASE}/stripe/portal`, { headers: { authorization: `Bearer ${token}` } }); const data = await res.json(); if (data.url) window.location.href = data.url; } catch {} }} className="text-xs font-medium underline underline-offset-2 cursor-pointer" style={{ color: "var(--muted)" }}>Manage billing</button>
              )}
            </div>
          </div>

          {quota && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                <span>Generation usage this month</span>
                <span>{quota.used} / {quota.limit >= 999999 ? "∞" : quota.limit}</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: "var(--border-light)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (quota.used / (quota.limit >= 999999 ? 1 : quota.limit)) * 100)}%`, background: quota.remaining > 0 ? "var(--gold)" : "var(--oxblood)" }} />
              </div>
              <p className="text-xs" style={{ color: "var(--subtle)" }}>
                {quota.remaining > 0 ? `${quota.remaining} generations remaining` : "Limit reached. Upgrade to generate more."}
              </p>
            </div>
          )}
        </section>

        {/* ── Preferences ── */}
        <section className="plate p-6 stagger-children">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--gold-bg)" }}>
              <IconPalette size={16} style={{ color: "var(--gold)" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>Preferences</h2>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium" style={{ color: "var(--muted)" }}>Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id: "light" as const, label: "Light", desc: "Warm paper", style: { background: "#f5efe0", color: "#1a1612" } },
                { id: "dark" as const, label: "Dark", desc: "Night mode", style: { background: "#1a1714", color: "#ece3d2" } },
                { id: "system" as const, label: "System", desc: "Follow device", style: { background: "linear-gradient(135deg, #f5efe0 50%, #1a1714 50%)", color: "#1a1612" } },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="rounded-md p-0 overflow-hidden transition-all duration-200 cursor-pointer text-left border"
                  style={{
                    borderColor: (resolved === t.id || (t.id === "system" && resolved !== "light" && resolved !== "dark")) ? "var(--gold)" : "var(--border)",
                    boxShadow: (resolved === t.id || (t.id === "system" && resolved !== "light" && resolved !== "dark")) ? "0 0 0 2px var(--gold-bg)" : "none",
                  }}
                >
                  <div className="h-10 flex items-center justify-center text-[10px] font-medium" style={t.style}>
                    {t.label}
                  </div>
                  <div className="px-2.5 py-1.5" style={{ background: "var(--surface-elevated)" }}>
                    <div className="text-xs font-medium" style={{ color: "var(--ink)" }}>{t.label}</div>
                    <div className="text-[10px]" style={{ color: "var(--subtle)" }}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Danger Zone ── */}
        <section className="plate p-6 stagger-children" style={{ borderColor: "var(--oxblood)" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--oxblood-subtle)" }}>
              <IconTrash size={16} style={{ color: "var(--oxblood)" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--oxblood)" }}>Danger Zone</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>Sign Out</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>End your current session</div>
            </div>
            <button onClick={() => { logout(); router.push("/login"); }} className="btn btn-sm cursor-pointer" style={{ color: "var(--oxblood)", border: "1px solid var(--oxblood)", background: "transparent" }}>
              <IconLogout size={14} /> Sign out
            </button>
          </div>
        </section>
      </div>
    </ContentCard>
  );
}
