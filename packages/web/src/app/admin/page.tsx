"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "../components/PageLayout";
import { useAuth, useAdminSettings, useArticleSearch } from "../hooks";
import { IconBook, IconX, IconSearch, IconCheck } from "../components/Icons";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data: settings, loading: settingsLoading, updateSettings, updating } = useAdminSettings();
  const [featured, setFeatured] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const { data: results } = useArticleSearch(search);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (settings?.featured_articles) {
      try { setFeatured(JSON.parse(settings.featured_articles)); } catch { setFeatured([]); }
    }
  }, [settings]);

  const addSlug = useCallback((slug: string) => {
    setFeatured((prev) => prev.includes(slug) ? prev : [...prev, slug]);
    setSearch("");
  }, []);

  const removeSlug = useCallback((slug: string) => {
    setFeatured((prev) => prev.filter((s) => s !== slug));
  }, []);

  async function handleSave() {
    const ok = await updateSettings({ featured_articles: JSON.stringify(featured) });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  if (authLoading) return null;
  if (!user) return null;

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto w-full px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>Admin</h1>

        {/* ── Featured Articles ── */}
        <section className="plate p-6 space-y-5">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <IconBook size={18} /> Featured Articles
          </h2>

          {/* Search + add */}
          <div className="relative">
            <IconSearch size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)", pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles to feature…"
              className="input text-sm w-full pl-9"
            />
            {search && results && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border rounded-sm z-10" style={{ background: "var(--surface-elevated)", borderColor: "var(--border)", maxHeight: 240, overflowY: "auto" }}>
                {results.slice(0, 10).map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => addSlug(a.slug)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--gold-bg)] flex items-center gap-2"
                    style={{ color: "var(--ink)", borderBottom: "1px solid var(--border-light)" }}
                  >
                    <span className="font-medium">{a.title}</span>
                    {featured.includes(a.slug) && <IconCheck size={14} style={{ color: "var(--green)" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current featured list */}
          <div className="space-y-2">
            {settingsLoading ? (
              <div className="text-sm" style={{ color: "var(--subtle)" }}>Loading…</div>
            ) : featured.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--subtle)" }}>No featured articles selected.</div>
            ) : (
              featured.map((slug) => (
                <div key={slug} className="flex items-center justify-between px-3 py-2 rounded-sm text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                  <span style={{ color: "var(--ink)" }}>{slug}</span>
                  <button onClick={() => removeSlug(slug)} className="p-1 rounded hover:bg-[var(--oxblood-subtle)]" style={{ color: "var(--oxblood)" }}>
                    <IconX size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={updating || settingsLoading} className="btn btn-primary btn-sm">
              {updating ? "Saving…" : "Save"}
            </button>
            {saved && <span className="flex items-center gap-1 text-sm" style={{ color: "var(--green)" }}><IconCheck size={14} /> Saved</span>}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
