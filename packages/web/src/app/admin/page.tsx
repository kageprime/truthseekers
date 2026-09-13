"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "../components/PageLayout";
import { useAuth, useAdminSettings, useArticleSearch, useModels, useConnectors, useUpdateCredential, useUsageStats, useSeedStatus, useSeedRun, useSeedPause, useCoordinatorStatus, useCoordinatorRun } from "../hooks";
import { IconBook, IconX, IconSearch, IconCheck, IconKey, IconCpu, IconActivity, IconLightning } from "../components/Icons";

function SeedPanel() {
  const { data: seed } = useSeedStatus(10000);
  const { mutate: runNow, loading: running } = useSeedRun();
  const { mutate: setPaused, loading: pausing } = useSeedPause();
  const [force, setForce] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleRun() {
    setMsg("");
    const res = await runNow(force);
    if (!res) { setMsg("Run failed"); return; }
    setMsg(res.queued ? `Queued ${res.queued}` : (res.reason || "Idle"));
  }

  async function handlePause(paused: boolean) {
    setMsg("");
    const ok = await setPaused(paused);
    setMsg(ok ? (paused ? "Trickle paused" : "Trickle resumed") : "Failed");
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <section className="plate p-6 space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
        <IconLightning size={18} /> Seed Trickle
      </h2>
      {!seed ? (
        <div className="text-sm" style={{ color: "var(--subtle)" }}>Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{seed.today.count}/{seed.today.limit}</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>Today ({seed.today.date})</div>
            </div>
            <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{seed.bench.live.length}/{seed.bench.total}</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>Bench live</div>
            </div>
            <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
              <div className="text-lg font-bold" style={{ color: seed.paused ? "var(--oxblood)" : "var(--green)" }}>{seed.paused ? "Paused" : "Live"}</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>Next tick {new Date(seed.next_tick).toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleRun} disabled={running} className="btn btn-primary btn-sm">
              {running ? "Queueing…" : "Run now"}
            </button>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--subtle)" }}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Override daily ceiling
            </label>
            <button
              onClick={() => handlePause(!seed.paused)}
              disabled={pausing}
              className="btn btn-sm"
              style={{ border: "1px solid var(--border)" }}
            >
              {seed.paused ? "Resume" : "Pause"}
            </button>
            {seed.auto_gaps && <span className="text-xs" style={{ color: "var(--gold)" }}>gap phase armed</span>}
          </div>
          {msg && <div className="text-xs" style={{ color: "var(--subtle)" }}>{msg}</div>}
          {seed.bench.pending.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {seed.bench.pending.map((slug) => (
                <span key={slug} className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border-light)", color: "var(--subtle)" }}>
                  {slug}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs" style={{ color: "var(--green)" }}>Bench complete — trickle idles{seed.auto_gaps ? " (gap phase active)" : ""}.</div>
          )}
        </>
      )}
    </section>
  );
}

function CoordinatorPanel() {
  const { data: coord } = useCoordinatorStatus(10000);
  const { mutate: runNow, loading: running } = useCoordinatorRun();
  const [force, setForce] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleRun() {
    setMsg("");
    const res = await runNow(force);
    if (!res) { setMsg("Run failed"); return; }
    const parts = [];
    if (res.featured?.length) parts.push(`featured: ${res.featured.join(", ")}`);
    if (res.stale_queued) parts.push(`queued stale: ${res.stale_queued}`);
    if (res.reason) parts.push(res.reason);
    setMsg(parts.join(" · ") || "Done");
  }

  const last = coord?.last_run ?? null;
  return (
    <section className="plate p-6 space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
        <IconBook size={18} /> Site Coordinator
      </h2>
      {!coord ? (
        <div className="text-sm" style={{ color: "var(--subtle)" }}>Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{coord.today.count}/{coord.today.limit}</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>Refreshes today ({coord.today.date})</div>
            </div>
            <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
              <div className="text-lg font-bold" style={{ color: coord.paused ? "var(--oxblood)" : "var(--green)" }}>{coord.paused ? "Paused" : "Live"}</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>Next tick {new Date(coord.next_tick).toLocaleString()}</div>
            </div>
            <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{last?.featured?.length ?? 0}</div>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>Featured picks (last run)</div>
            </div>
          </div>
          {last && (
            <div className="text-xs space-y-1" style={{ color: "var(--subtle)" }}>
              <div>Last run {new Date(last.at).toLocaleString()}{last.stale_queued ? ` · queued stale: ${last.stale_queued}` : ""}</div>
              {last.featured?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {last.featured.map((slug: string) => (
                    <span key={slug} className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border-light)", color: "var(--subtle)" }}>
                      {slug}
                    </span>
                  ))}
                </div>
              )}
              {last.reason && <div>{last.reason}</div>}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleRun} disabled={running} className="btn btn-primary btn-sm">
              {running ? "Coordinating…" : "Run now"}
            </button>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--subtle)" }}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Override pause + ceiling
            </label>
          </div>
          {msg && <div className="text-xs" style={{ color: "var(--subtle)" }}>{msg}</div>}
          <p className="text-xs" style={{ color: "var(--subtle)" }}>
            Daily at {coord.schedule} UTC: scores published articles (freshness · views · claim depth · recency), writes the top 3 to featured, and queues the stalest article for refresh. Pause is shared with Seed Trickle.
          </p>
        </>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data: settings, loading: settingsLoading, updateSettings, updating } = useAdminSettings();
  const { data: models } = useModels();
  const { data: connectors } = useConnectors();
  const { data: usage } = useUsageStats();
  const { mutate: updateCred, loading: credSaving } = useUpdateCredential();
  const [featured, setFeatured] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [credService, setCredService] = useState("groq");
  const [credToken, setCredToken] = useState("");
  const [credMsg, setCredMsg] = useState("");
  const { data: results } = useArticleSearch(search);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (!authLoading && user && user.role !== "owner" && user.role !== "admin") router.replace("/");
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

  async function handleCredSave() {
    if (!credToken.trim()) return;
    const ok = await updateCred({ service: credService, token: credToken });
    setCredMsg(ok ? "Token updated" : "Failed");
    setTimeout(() => setCredMsg(""), 2000);
    if (ok) setCredToken("");
  }

  if (authLoading) return null;
  if (!user) return null;
  // ponytail: admin surfaces are owner/admin only — members bounce home.
  if (user.role !== "owner" && user.role !== "admin") {
    return (
      <div className="py-12 text-center">
        <div className="text-[11px] py-8 border-[2px] bg-[#ffffe1] inline-block px-8" style={{ borderStyle: "outset", borderWidth: 2 }}>
          Restricted — administrators only.
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto w-full px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>Admin</h1>

        {/* ── Credential Management ── */}
        <section className="plate p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <IconKey size={18} /> Credential Management
          </h2>
          <p className="text-xs" style={{ color: "var(--subtle)" }}>Hot-swap API tokens without restarting the server.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--subtle)" }}>Service</label>
              <select value={credService} onChange={(e) => setCredService(e.target.value)} className="input text-sm w-full">
                {["groq", "do", "openai", "tavily", "firecrawl"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex-[2] space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--subtle)" }}>Token</label>
              <input type="password" value={credToken} onChange={(e) => setCredToken(e.target.value)} placeholder="sk-..." className="input text-sm w-full" />
            </div>
            <button onClick={handleCredSave} disabled={credSaving || !credToken.trim()} className="btn btn-primary btn-sm" style={{ marginBottom: 0 }}>
              {credSaving ? "Saving…" : "Update"}
            </button>
          </div>
          {credMsg && <span className="text-xs" style={{ color: credMsg === "Token updated" ? "var(--green)" : "var(--oxblood)" }}>{credMsg}</span>}
        </section>

        {/* ── Seed Trickle (auto-generation ops) ── */}
        <SeedPanel />

        {/* ── Site Coordinator (featured + stale refresh) ── */}
        <CoordinatorPanel />

        {/* ── Featured Articles ── */}
        <section className="plate p-6 space-y-5">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <IconBook size={18} /> Featured Articles
          </h2>

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

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={updating || settingsLoading} className="btn btn-primary btn-sm">
              {updating ? "Saving…" : "Save"}
            </button>
            {saved && <span className="flex items-center gap-1 text-sm" style={{ color: "var(--green)" }}><IconCheck size={14} /> Saved</span>}
          </div>
        </section>

        {/* ── LLM Models ── */}
        <section className="plate p-6 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <IconCpu size={18} /> LLM Models
          </h2>
          {!models || models.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--subtle)" }}>No models loaded.</div>
          ) : (
            <div className="space-y-2">
              {models.map((m: any) => (
                <div key={m.name} className="flex items-center justify-between px-3 py-2 rounded-sm text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                  <div>
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{m.displayName || m.name}</span>
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--gold-bg)", color: "var(--gold)" }}>{m.provider}</span>
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: "var(--subtle)" }}>
                    {m.toolCall && <span>tools</span>}
                    {m.reasoning && <span>reasoning</span>}
                    {m.contextLimit > 0 && <span>{(m.contextLimit / 1000).toFixed(0)}K ctx</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Connectors ── */}
        <section className="plate p-6 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <IconActivity size={18} /> Connectors
          </h2>
          {!connectors || connectors.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--subtle)" }}>No connectors registered.</div>
          ) : (
            <div className="space-y-2">
              {connectors.map((c: any) => (
                <div key={c.slug} className="flex items-center justify-between px-3 py-2 rounded-sm text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                  <div>
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{c.name || c.slug}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--subtle)" }}>{c.provider}</span>
                  </div>
                  <div className="flex gap-2 text-xs" style={{ color: "var(--subtle)" }}>
                    {(c.actions || []).map((a: any) => (
                      <span key={a.name} className={`px-1.5 py-0.5 rounded ${a.risk === "write" ? "bg-[var(--oxblood-subtle)] text-[var(--oxblood)]" : "bg-[var(--gold-bg)] text-[var(--gold)]"}`}>
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── LLM Usage Stats ── */}
        {usage && (
          <section className="plate p-6 space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
              <IconActivity size={18} /> LLM Usage
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{usage.totals?.callCount ?? 0}</div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>Calls</div>
              </div>
              <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{(usage.totals?.totalTokens ?? 0).toLocaleString()}</div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>Tokens</div>
              </div>
              <div className="px-3 py-2 rounded-sm text-center" style={{ background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>${(usage.totals?.totalCost ?? 0).toFixed(4)}</div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>Cost</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
