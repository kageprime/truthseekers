"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { canSeeAdmin } from "@/lib/routes";
import { useAuth, useAdminSettings, useArticleSearch, useModels, useConnectors, useUpdateCredential, useUsageStats, useSeedStatus, useSeedRun, useSeedPause, useCoordinatorStatus, useCoordinatorRun, useHealth } from "../hooks";
import { IconBook, IconX, IconSearch, IconCheck, IconKey, IconCpu, IconActivity, IconLightning } from "../components/Icons";

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="px-3 py-2 rounded-[var(--r-radius)] text-center bg-[var(--r-surface)] border border-[var(--r-border)]">
      <div className="text-[16px] font-bold tabular-nums" style={{ color: tone ?? "var(--r-ink)" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--r-muted)" }}>{label}</div>
    </div>
  );
}

function SeedPanel() {
  const { data: seed, loading } = useSeedStatus(10000);
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
    <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-3">
      <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
        <IconLightning size={15} /> Seed Trickle
      </h2>
      {!seed ? (
        <div className="text-[12px] py-4 text-center" style={{ color: "var(--r-muted)" }}>
          {loading ? "Loading…" : "Seed status unavailable — is the API reachable?"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Stat value={`${seed.today.count}/${seed.today.limit}`} label={`Today ${seed.today.date}`} />
            <Stat value={`${seed.bench.live.length}/${seed.bench.total}`} label="Bench live" />
            <Stat value={seed.paused ? "Paused" : "Live"} label={`Next ${new Date(seed.next_tick).toLocaleTimeString()}`} tone={seed.paused ? "#a33a3a" : "#2e7d32"} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRun} disabled={running} className="r-btn">
              {running ? "Queueing…" : "Run now"}
            </button>
            <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--r-muted)" }}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Override daily ceiling
            </label>
            <button onClick={() => handlePause(!seed.paused)} disabled={pausing} className="r-btn">
              {seed.paused ? "Resume" : "Pause"}
            </button>
            {seed.auto_gaps && <span className="text-[11px]" style={{ color: "var(--r-accent)" }}>gap phase armed</span>}
          </div>
          {msg && <div className="text-[11px]" style={{ color: "var(--r-muted)" }}>{msg}</div>}
          {seed.bench.pending.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {seed.bench.pending.map((slug) => (
                <span key={slug} className="text-[11px] px-2 py-0.5 rounded-sm bg-[var(--r-surface)] border border-[var(--r-border)]" style={{ color: "var(--r-muted)" }}>
                  {slug}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px]" style={{ color: "#2e7d32" }}>Bench complete — trickle idles{seed.auto_gaps ? " (gap phase active)" : ""}.</div>
          )}
        </>
      )}
    </section>
  );
}

function CoordinatorPanel() {
  const { data: coord, loading } = useCoordinatorStatus(10000);
  const { mutate: runNow, loading: running } = useCoordinatorRun();
  const { mutate: setPaused, loading: pausing } = useSeedPause();
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

  async function handlePause(paused: boolean) {
    setMsg("");
    const ok = await setPaused(paused);
    setMsg(ok ? (paused ? "Coordinator paused" : "Coordinator resumed") : "Failed");
    setTimeout(() => setMsg(""), 2500);
  }

  const last = coord?.last_run ?? null;
  return (
    <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-3">
      <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
        <IconBook size={15} /> Site Coordinator
      </h2>
      {!coord ? (
        <div className="text-[12px] py-4 text-center" style={{ color: "var(--r-muted)" }}>
          {loading ? "Loading…" : "Coordinator status unavailable — is the API reachable?"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Stat value={`${coord.today.count}/${coord.today.limit}`} label={`Refreshes ${coord.today.date}`} />
            <Stat value={coord.paused ? "Paused" : "Live"} label={`Next ${new Date(coord.next_tick).toLocaleString()}`} tone={coord.paused ? "#a33a3a" : "#2e7d32"} />
            <Stat value={String(last?.featured?.length ?? 0)} label="Featured picks" />
          </div>
          {last && (
            <div className="text-[11px] space-y-1.5 border-t border-[var(--r-border)] pt-2.5" style={{ color: "var(--r-muted)" }}>
              <div className="tabular-nums">
                Last run {new Date(last.at).toLocaleString()}
                {last.stale_queued ? (
                  <> · queued stale <Link href={`/article/${last.stale_queued}`} className="font-bold underline" style={{ color: "var(--r-accent)" }}>{last.stale_queued}</Link></>
                ) : ""}
              </div>
              {last.featured?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {last.featured.map((slug: string) => (
                    <Link key={slug} href={`/article/${slug}`} className="text-[11px] px-2 py-0.5 rounded-sm bg-[var(--r-surface)] border border-[var(--r-border)] no-underline hover:border-[var(--r-accent)]" style={{ color: "var(--r-ink)" }}>
                      {slug}
                    </Link>
                  ))}
                </div>
              )}
              {last.reason && <div>{last.reason}</div>}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRun} disabled={running} className="r-btn">
              {running ? "Coordinating…" : "Run now"}
            </button>
            <button onClick={() => handlePause(!coord.paused)} disabled={pausing} className="r-btn">
              {coord.paused ? "Resume" : "Pause"}
            </button>
            <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--r-muted)" }}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Override pause + ceiling
            </label>
          </div>
          {msg && <div className="text-[11px]" style={{ color: "var(--r-muted)" }}>{msg}</div>}
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--r-muted)" }}>
            Daily at {coord.schedule} UTC: scores published articles (freshness · views · claim depth · recency), tops up featured around your pinned picks, and queues the stalest article for refresh. Schedule and daily ceiling are backend constants.
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
  const { data: health } = useHealth();
  const { mutate: updateCred, loading: credSaving } = useUpdateCredential();
  const [featured, setFeatured] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");
  const [credService, setCredService] = useState("groq");
  const [credToken, setCredToken] = useState("");
  const [credMsg, setCredMsg] = useState("");
  const { data: results } = useArticleSearch(search);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    else if (!authLoading && user && !canSeeAdmin(user.role)) router.replace("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (settings?.featured_pinned) {
      try {
        const parsed = JSON.parse(settings.featured_pinned);
        setFeatured(Array.isArray(parsed) ? parsed : []);
      } catch { setFeatured([]); }
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
    // ponytail: updateSettings resolves undefined on transport failure —
    // report it instead of showing "Saved" for a silent drop.
    const ok = await updateSettings({ featured_pinned: JSON.stringify(featured) });
    setSaveState(ok ? "saved" : "failed");
    setTimeout(() => setSaveState("idle"), 2500);
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
  if (!canSeeAdmin(user.role)) {
    return (
      <div className="py-12 text-center">
        <div className="text-[11px] py-8 bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] inline-block px-8">
          Restricted — administrators only.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--r-border)] pb-3">
        <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--r-muted)" }}>Operations</div>
        <h1 className="r-h1 text-[26px] sm:text-[32px]">Admin</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--r-muted)" }}>Seed ops, coordinator, featured content, and system credentials.</p>
      </div>

      {/* ── Ops ── */}
      <div className="text-[10px] font-bold tracking-widest uppercase pt-1" style={{ color: "var(--r-muted)" }}>Automation</div>
      <SeedPanel />
      <CoordinatorPanel />

      {/* ── Content ── */}
      <div className="text-[10px] font-bold tracking-widest uppercase pt-1" style={{ color: "var(--r-muted)" }}>Content</div>
      <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-3">
        <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
          <IconBook size={15} /> Featured Articles
        </h2>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--r-muted)" }}>
          Pinned picks always lead the homepage and survive the nightly coordinator, which tops up to 3 around them.
        </p>

        <div className="relative">
          <IconSearch size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--r-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles to pin…"
            className="w-full bg-[var(--r-surface)] border border-[var(--r-border)] pl-8 pr-3 py-1.5 text-[12px] rounded-[var(--r-radius)] outline-none focus:ring-1"
            style={{ color: "var(--r-ink)" }}
          />
          {search && results && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 border rounded-[var(--r-radius)] z-10 bg-[var(--r-surface-elevated)]" style={{ borderColor: "var(--r-border)", maxHeight: 240, overflowY: "auto" }}>
              {results.slice(0, 10).map((a) => (
                <button
                  key={a.slug}
                  onClick={() => addSlug(a.slug)}
                  className="w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 bg-transparent border-0 border-b border-[var(--r-border)] cursor-pointer hover:brightness-95"
                  style={{ color: "var(--r-ink)" }}
                >
                  <span className="font-medium">{a.title}</span>
                  {featured.includes(a.slug) && <IconCheck size={13} style={{ color: "#2e7d32" }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          {settingsLoading ? (
            <div className="text-[12px]" style={{ color: "var(--r-muted)" }}>Loading…</div>
          ) : featured.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--r-muted)" }}>No pinned articles — the coordinator fills featured on its own.</div>
          ) : (
            featured.map((slug) => (
              <div key={slug} className="flex items-center justify-between px-3 py-1.5 rounded-[var(--r-radius)] text-[12px] bg-[var(--r-surface)] border border-[var(--r-border)]">
                <span style={{ color: "var(--r-ink)" }}>{slug}</span>
                <button onClick={() => removeSlug(slug)} className="p-1 rounded-sm bg-transparent border-0 cursor-pointer" style={{ color: "#a33a3a" }} aria-label={`Remove ${slug}`}>
                  <IconX size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={updating || settingsLoading} className="r-btn">
            {updating ? "Saving…" : "Save pins"}
          </button>
          {saveState === "saved" && <span className="flex items-center gap-1 text-[12px]" style={{ color: "#2e7d32" }}><IconCheck size={13} /> Saved</span>}
          {saveState === "failed" && <span className="text-[12px]" style={{ color: "#a33a3a" }}>Save failed — is the API reachable?</span>}
        </div>
      </section>

      {/* ── System ── */}
      <div className="text-[10px] font-bold tracking-widest uppercase pt-1" style={{ color: "var(--r-muted)" }}>System</div>
      <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-2">
        <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
          <IconCpu size={15} /> Storage
        </h2>
        {!health ? (
          <div className="text-[12px]" style={{ color: "var(--r-muted)" }}>Health unavailable.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Stat
                value={health.storage_mode ?? "unknown"}
                label="Storage mode"
                tone={health.storage_mode === "postgres" ? "#2e7d32" : "#a33a3a"}
              />
              <Stat value={String(health.article_count ?? 0)} label="Articles" />
            </div>
            {health.storage_mode !== "postgres" && (
              <div className="text-[11px] font-bold" style={{ color: "#a33a3a" }}>
                FILE MODE — users and content vanish on restart. Set DATABASE_URL on the backend.
              </div>
            )}
          </>
        )}
      </section>
      <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-3">
        <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
          <IconKey size={15} /> Credential Management
        </h2>
        <p className="text-[11px]" style={{ color: "var(--r-muted)" }}>Hot-swap API tokens without restarting the server.</p>
        <div className="flex gap-2 items-end flex-col sm:flex-row">
          <div className="flex-1 min-w-0 w-full space-y-1">
            <label className="text-[11px] font-medium" style={{ color: "var(--r-muted)" }}>Service</label>
            <select value={credService} onChange={(e) => setCredService(e.target.value)} className="w-full bg-[var(--r-surface)] border border-[var(--r-border)] px-2.5 py-1.5 text-[12px] rounded-[var(--r-radius)]" style={{ color: "var(--r-ink)" }}>
              {["groq", "do", "openai", "tavily", "firecrawl"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] min-w-0 w-full space-y-1">
            <label className="text-[11px] font-medium" style={{ color: "var(--r-muted)" }}>Token</label>
            <input type="password" value={credToken} onChange={(e) => setCredToken(e.target.value)} placeholder="sk-..." className="w-full bg-[var(--r-surface)] border border-[var(--r-border)] px-2.5 py-1.5 text-[12px] rounded-[var(--r-radius)]" style={{ color: "var(--r-ink)" }} />
          </div>
          <button onClick={handleCredSave} disabled={credSaving || !credToken.trim()} className="r-btn w-full sm:w-auto">
            {credSaving ? "Saving…" : "Update"}
          </button>
        </div>
        {credMsg && <span className="text-[11px]" style={{ color: credMsg === "Token updated" ? "#2e7d32" : "#a33a3a" }}>{credMsg}</span>}
      </section>

      <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-2">
        <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
          <IconCpu size={15} /> LLM Models
        </h2>
        {!models || models.length === 0 ? (
          <div className="text-[12px]" style={{ color: "var(--r-muted)" }}>No models loaded.</div>
        ) : (
          <div className="space-y-1.5">
            {models.map((m: any) => (
              <div key={m.name} className="flex items-center justify-between px-3 py-1.5 rounded-[var(--r-radius)] text-[12px] bg-[var(--r-surface)] border border-[var(--r-border)]">
                <div>
                  <span className="font-medium" style={{ color: "var(--r-ink)" }}>{m.displayName || m.name}</span>
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--r-header-accent)] text-black font-bold">{m.provider}</span>
                </div>
                <div className="flex gap-2 text-[11px] tabular-nums" style={{ color: "var(--r-muted)" }}>
                  {m.toolCall && <span>tools</span>}
                  {m.reasoning && <span>reasoning</span>}
                  {m.contextLimit > 0 && <span>{(m.contextLimit / 1000).toFixed(0)}K ctx</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-2">
        <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
          <IconActivity size={15} /> Connectors
        </h2>
        {!connectors || connectors.length === 0 ? (
          <div className="text-[12px]" style={{ color: "var(--r-muted)" }}>No connectors registered.</div>
        ) : (
          <div className="space-y-1.5">
            {connectors.map((c: any) => (
              <div key={c.slug} className="flex items-center justify-between px-3 py-1.5 rounded-[var(--r-radius)] text-[12px] bg-[var(--r-surface)] border border-[var(--r-border)]">
                <div>
                  <span className="font-medium" style={{ color: "var(--r-ink)" }}>{c.name || c.slug}</span>
                  <span className="ml-2 text-[11px]" style={{ color: "var(--r-muted)" }}>{c.provider}</span>
                </div>
                <div className="flex gap-1.5 text-[10px] font-bold">
                  {(c.actions || []).map((a: any) => (
                    <span key={a.name} className="px-1.5 py-0.5 rounded-sm" style={a.risk === "write" ? { background: "rgba(163,58,58,0.12)", color: "#a33a3a" } : { background: "var(--r-nav-bg)", color: "var(--r-muted)" }}>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3.5 space-y-2">
        <h2 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "var(--r-ink)" }}>
          <IconActivity size={15} /> LLM Usage
        </h2>
        {!usage ? (
          <div className="text-[12px]" style={{ color: "var(--r-muted)" }}>No usage data yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Stat value={String(usage.totals?.callCount ?? 0)} label="Calls" />
            <Stat value={(usage.totals?.totalTokens ?? 0).toLocaleString()} label="Tokens" />
            <Stat value={`$${(usage.totals?.totalCost ?? 0).toFixed(4)}`} label="Cost" />
          </div>
        )}
      </section>
    </div>
  );
}
