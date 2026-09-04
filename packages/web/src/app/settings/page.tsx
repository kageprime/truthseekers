"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../components/ThemeProvider";
import { useQuota, useUpdateProfile, useStripePortal } from "../hooks";
import PageLayout from "../components/PageLayout";
import { IconUser, IconLightning, IconPalette, IconLogout, IconCheck, IconX, IconTrash } from "../components/Icons";

const tierMeta: Record<string, { label: string; bg: string; fg: string }> = {
  free: { label: "Free", bg: "color-mix(in srgb, var(--subtle) 10%, transparent)", fg: "var(--subtle)" },
  pro: { label: "Pro", bg: "color-mix(in srgb, var(--gold) 15%, transparent)", fg: "var(--gold)" },
  enterprise: { label: "Enterprise", bg: "#fef3c7", fg: "#92400e" },
  admin: { label: "Admin", bg: "#ede9fe", fg: "#6d28d9" },
};

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
  const { mutate: updateProfile, loading: updating } = useUpdateProfile();
  const { mutate: portal } = useStripePortal();

  async function handlePortal() {
    try {
      const data = await portal();
      if (data?.url) window.location.href = data.url;
    } catch {}
  }

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) { setName(user.name || ""); setAvatar(user.avatar || ""); }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    const ok = await updateProfile({ name, avatar: avatar || undefined });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else { setError("Failed to save"); }
    setSaving(false);
  }

  const tier = tierMeta[user?.subscriptionTier ?? "free"] || tierMeta.free;

  if (authLoading || !user) {
    return (
      <PageLayout maxWidthClass="max-w-2xl" className="space-y-5 stagger-children">
        <div className="mb-8">
          <div className="h-8 skeleton w-32 rounded mb-2" />
          <div className="h-4 skeleton w-56 rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div
              className="p-[3px]"
              style={{ borderRadius: "var(--radius-card-lg)", background: "var(--border-light)" }}
            >
              <div
                className="p-6 sm:p-8"
                style={{
                  borderRadius: "calc(var(--radius-card-lg) - 3px)",
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-full skeleton" />
                  <div className="h-5 skeleton w-24 rounded" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 skeleton w-full rounded" />
                  <div className="h-4 skeleton w-3/4 rounded" />
                  <div className="h-4 skeleton w-1/2 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </PageLayout>
    );
  }

  const panels = [
    // Profile
    { id: "profile", icon: IconUser, title: "Profile", content: (
      <form onSubmit={handleSave} className="space-y-5">
        <Field label="Email">
          <input type="email" value={user.email} disabled className="w-full px-4 py-3 text-sm opacity-50 outline-none" style={{ borderRadius: "var(--radius-card-lg)", background: "var(--surface)", border: "1px solid transparent", color: "var(--ink)", cursor: "not-allowed" }} />
        </Field>
        <Field label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-4 py-3 text-sm outline-none transition-all" style={{ borderRadius: "var(--radius-card-lg)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)" }} onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"} />
        </Field>
        <Field label="Avatar URL">
          <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://example.com/avatar.jpg" className="w-full px-4 py-3 text-sm outline-none transition-all" style={{ borderRadius: "var(--radius-card-lg)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)" }} onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"} />
        </Field>
        {error && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--red)" }}>
            <IconX size={12} /> {error}
          </div>
        )}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving} className="group cursor-pointer px-5 py-2.5 text-sm font-medium transition-all duration-200" style={{ borderRadius: "9999px", background: "var(--accent)", color: "white", border: "none" }}>
            <span className="flex items-center gap-2">
              {saving ? "Saving..." : "Save changes"}
              <span className="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 group-hover:translate-x-0.5" style={{ background: "rgba(255,255,255,0.15)", transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </span>
            </span>
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--forest)" }}>
              <IconCheck size={12} /> Saved
            </span>
          )}
        </div>
      </form>
    )},
    // Subscription
    { id: "subscription", icon: IconLightning, title: "Subscription", content: (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase px-3 py-1 rounded-full" style={{ background: tier.bg, color: tier.fg }}>{tier.label}</span>
            {user.subscriptionTier === "free" && <Link href="/pricing" className="text-xs font-medium underline underline-offset-2" style={{ color: "var(--accent)" }}>Upgrade plan</Link>}
            {user.subscriptionTier === "pro" && (
              <button onClick={() => handlePortal()} className="text-xs font-medium underline underline-offset-2 cursor-pointer" style={{ color: "var(--muted)", background: "none", border: "none" }}>Manage billing</button>
            )}
          </div>
        </div>
        {quota && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
              <span>Generation usage this month</span>
              <span className="tabular-nums">{quota.used} / {quota.limit >= 999999 ? "∞" : quota.limit}</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border-light)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (quota.used / (quota.limit >= 999999 ? 1 : quota.limit)) * 100)}%`, background: "var(--accent)" }} />
            </div>
            <p className="text-xs" style={{ color: "var(--subtle)" }}>
              {quota.remaining > 0 ? `${quota.remaining} generations remaining` : "Limit reached. Upgrade to generate more."}
            </p>
          </div>
        )}
      </div>
    )},
    // Preferences
    { id: "preferences", icon: IconPalette, title: "Preferences", content: (
      <div className="space-y-4">
        <label className="block text-xs font-medium" style={{ color: "var(--muted)" }}>Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { id: "light" as const, label: "Light", desc: "Warm paper", style: { background: "#f5efe0", color: "#1a1612" } },
            { id: "dark" as const, label: "Dark", desc: "Night mode", style: { background: "#1a1714", color: "#ece3d2" } },
            { id: "system" as const, label: "System", desc: "Follow device", style: { background: "linear-gradient(135deg, #f5efe0 50%, #1a1714 50%)", color: "#1a1612" } },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} className="rounded-md p-0 overflow-hidden transition-all duration-200 cursor-pointer text-left border" style={{ borderColor: resolved === t.id || (t.id === "system" && resolved !== "light" && resolved !== "dark") ? "var(--accent)" : "var(--border)", boxShadow: resolved === t.id || (t.id === "system" && resolved !== "light" && resolved !== "dark") ? `0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)` : "none" }}>
              <div className="h-10 flex items-center justify-center text-[10px] font-medium" style={t.style}>{t.label}</div>
              <div className="px-2.5 py-1.5" style={{ background: "var(--surface)" }}>
                <div className="text-xs font-medium" style={{ color: "var(--ink)" }}>{t.label}</div>
                <div className="text-[10px]" style={{ color: "var(--subtle)" }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )},
    // Danger Zone
    { id: "danger", icon: IconTrash, title: "Danger Zone", danger: true, content: (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>Sign Out</div>
          <div className="text-xs" style={{ color: "var(--subtle)" }}>End your current session</div>
        </div>
        <button onClick={() => { logout(); router.push("/login"); }} className="group cursor-pointer px-5 py-2.5 text-sm font-medium transition-all duration-200" style={{ borderRadius: "9999px", background: "transparent", border: "1px solid var(--oxblood)", color: "var(--oxblood)" }}>
          <span className="flex items-center gap-2">
            <IconLogout size={14} /> Sign out
          </span>
        </button>
      </div>
    )},
  ];

  return (
    <PageLayout maxWidthClass="max-w-2xl" className="space-y-5 stagger-children">
        <div className="mb-8">
          <h1 className="font-display font-bold tracking-tight mb-1" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "var(--ink)" }}>Settings</h1>
          <p className="text-sm font-serif italic" style={{ color: "var(--muted)" }}>Manage your account and preferences</p>
        </div>

        {panels.map((panel, i) => {
          const Icon = panel.icon;
          return (
            <div key={panel.id}>
              <div
                className="p-[3px] transition-all duration-300"
                style={{
                  borderRadius: "var(--radius-card-lg)",
                  background: panel.danger
                    ? "color-mix(in srgb, var(--oxblood) 8%, transparent)"
                    : "var(--border-light)",
                  opacity: 0,
                  animation: `appear 0.5s ease ${0.1 + i * 0.08}s forwards`,
                }}
              >
                <div
                  className="p-6 sm:p-8"
                  style={{
                    borderRadius: "calc(var(--radius-card-lg) - 3px)",
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border-light)",
                    boxShadow: panel.danger
                      ? "0 1px 2px rgba(0,0,0,0.02), 0 0 0 1px color-mix(in srgb, var(--oxblood) 8%, transparent)"
                      : "inset 0 1px 1px rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: panel.danger
                          ? "color-mix(in srgb, var(--oxblood) 10%, transparent)"
                          : "color-mix(in srgb, var(--accent) 8%, transparent)",
                      }}
                    >
                      <Icon size={16} style={{ color: panel.danger ? "var(--oxblood)" : "var(--accent)" }} />
                    </div>
                    <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>{panel.title}</h2>
                  </div>
                  {panel.content}
                </div>
              </div>
            </div>
          );
        })}
    </PageLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}
