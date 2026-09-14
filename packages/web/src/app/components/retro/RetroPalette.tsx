"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RETRO_ROUTES, canSeeAdmin, crumbLabel } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";


interface Entry { kind: "page" | "action" | "recent"; label: string; hint: string; run: () => void; keys: string; }

const RECENT_KEY = "truthseekers_recent_paths";

function readRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}

export default function RetroPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const invoker = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const list = [pathname, ...readRecents().filter((p) => p !== pathname)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      setRecents(list);
    } catch {}
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false); setQ(""); setIdx(0);
    invoker.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        invoker.current = document.activeElement as HTMLElement | null;
        setRecents(readRecents());
        setOpen((o) => !o); setQ(""); setIdx(0);
      } else if (e.key === "Escape" && open) { e.preventDefault(); close(); }
    };
    const onBridge = () => {
      invoker.current = document.activeElement as HTMLElement | null;
      setRecents(readRecents());
      setOpen(true); setQ(""); setIdx(0);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("retro-palette-open", onBridge);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("retro-palette-open", onBridge); };
  }, [open, close]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const entries: Entry[] = useMemo(() => {
    const go = (href: string) => () => { close(); router.push(href); };
    const admin = canSeeAdmin(user?.role);
    const pages: Entry[] = RETRO_ROUTES.filter((r) => !r.adminOnly || admin).map((r) => ({ kind: "page", label: r.label, hint: r.href, run: go(r.href), keys: `${r.label} ${r.href} ${r.keywords}`.toLowerCase() }));
    const actions: Entry[] = [

      { kind: "action", label: "New article", hint: "action", run: go("/article/new"), keys: "new article write create generate" },
      { kind: "action", label: "New chat", hint: "action", run: go("/chat/new"), keys: "new chat ask agent conversation" },
      { kind: "action", label: "Go back", hint: "action", run: () => { close(); router.back(); }, keys: "back previous go back" },
      { kind: "action", label: "Go forward", hint: "action", run: () => { close(); router.forward(); }, keys: "forward next go forward" },
      { kind: "action", label: "Copy page address", hint: "action", run: () => { try { navigator.clipboard.writeText(window.location.href); } catch {} close(); }, keys: "copy address url link share" },
    ];
    const seen = new Set<string>();
    const recent: Entry[] = recents.filter((p) => p !== pathname && !seen.has(p) && (seen.add(p), true)).slice(0, 4)
      .map((p) => ({ kind: "recent", label: crumbLabel(p.split("/").filter(Boolean).pop() ?? "") + `  (${p})`, hint: p, run: go(p), keys: p.toLowerCase() }));
    return [...recent, ...actions, ...pages];
  }, [recents, pathname, router, close, user?.role]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries.slice(0, 12);
    return entries.filter((e) => needle.split(/\s+/).every((w) => e.keys.includes(w))).slice(0, 12);
  }, [entries, q]);

  useEffect(() => { setIdx(0); }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-start justify-center p-4 pt-[12vh] overflow-y-auto" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }} onClick={close} role="presentation">
      <div
        className="bg-[var(--r-surface)] w-full max-w-[520px] max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col my-auto border border-[var(--r-border)] rounded-[var(--r-radius)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Go to…"
      >
        <div className="bg-[var(--r-title-bg)] text-white text-[11px] font-bold px-3 py-2 flex items-center justify-between">
          <span>TruthSeekers — Command Palette</span>
          <span className="bg-[var(--r-header-accent)] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">CTRL+K</span>
        </div>
        <div className="p-3 space-y-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); filtered[idx]?.run(); }
            }}
            placeholder="Type a page, action, or theme style…"
            aria-label="Go to a page or action"
            aria-expanded
            role="combobox"
            aria-controls="retro-palette-list"
            aria-activedescendant={filtered[idx] ? `rp-${idx}` : undefined}
            className="w-full px-3 py-2 text-[14px] bg-[var(--r-surface-elevated)] text-[var(--r-ink)] border border-[var(--r-border)] rounded-[var(--r-radius)] outline-none focus:ring-2 focus:ring-[var(--r-accent)]"
          />
          <ul id="retro-palette-list" role="listbox" aria-label="Matches" className="max-h-[300px] overflow-auto bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] divide-y divide-[var(--r-border)]/50 r-scroll">
            {filtered.length === 0 && <li className="px-3 py-4 text-[12px] text-center text-[var(--r-muted)]">No match — try searching "theme", "chat", or a page title.</li>}
            {filtered.map((e, i) => (
              <li key={`${e.kind}-${e.hint}-${e.label}`} id={`rp-${i}`} role="option" aria-selected={i === idx}>
                <button
                  onClick={() => e.run()}
                  onMouseEnter={() => setIdx(i)}
                  className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2.5 transition-colors ${i === idx ? "bg-[var(--r-accent)] text-white" : "bg-transparent text-[var(--r-ink)] hover:bg-black/5"}`}
                  style={i === idx ? { color: "#ffffff" } : undefined}
                >
                  <span className="text-[8px] font-bold px-1.5 py-0.5 border border-current shrink-0 uppercase rounded-sm">{e.kind}</span>
                  <span className="flex-1 truncate font-medium">{e.label}</span>
                  <span className="text-[10px] opacity-70 truncate max-w-[160px]">{e.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
