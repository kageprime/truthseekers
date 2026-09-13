"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RETRO_ROUTES, canSeeAdmin, crumbLabel } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";

// ponytail: one palette for everywhere — static registry + actions + local recents. No backend, works offline.
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

  // ponytail: MRU trail — current path recorded on every navigation.
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
    // ponytail: touch entry — the titlebar Go to… button fires this (no keyboard on a PWA phone).
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
  }, [open ]);

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
    return [...recent, ...pages, ...actions];
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
        className="bg-[#efe9d5] w-full max-w-[520px] max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col my-auto"
        style={{ borderStyle: "outset", borderWidth: 3, borderColor: "#fff8e0 #8a7f68 #8a7f68 #fff8e0", boxShadow: "6px 6px 0 rgba(0,0,0,.4)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Go to…"
      >
        <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 flex items-center justify-between">
          <span>TruthSeekers — Go to…</span>
          <span className="bg-[#c9a227] text-black text-[9px] px-1 border border-black">CTRL+K</span>
        </div>
        <div className="p-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); filtered[idx]?.run(); }
            }}
            placeholder="Type a page or action…"
            aria-label="Go to a page or action"
            aria-expanded
            role="combobox"
            aria-controls="retro-palette-list"
            aria-activedescendant={filtered[idx] ? `rp-${idx}` : undefined}
            className="w-full px-2 py-1.5 text-[16px] bg-white text-black"
            style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }}
          />
          <ul id="retro-palette-list" role="listbox" aria-label="Matches" className="mt-1.5 max-h-[300px] overflow-auto bg-white border-[2px]" style={{ borderStyle: "inset", borderColor: "#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
            {filtered.length === 0 && <li className="px-2 py-3 text-[11px] text-center" style={{ color: "#8a7f68" }}>No match — try fewer words.</li>}
            {filtered.map((e, i) => (
              <li key={`${e.kind}-${e.hint}-${e.label}`} id={`rp-${i}`} role="option" aria-selected={i === idx}>
                <button
                  onClick={() => e.run()}
                  onMouseEnter={() => setIdx(i)}
                  className={`w-full text-left px-2 py-1 text-[12px] flex items-center gap-2 border ${i === idx ? "bg-[#0a2a5e] text-white border-[#0a2a5e]" : "bg-transparent border-transparent text-black"}`}
                  style={i === idx ? { color: "#fff" } : undefined}
                >
                  <span className="text-[8px] font-bold px-1 border border-current shrink-0 uppercase">{e.kind}</span>
                  <span className="flex-1 truncate">{e.label}</span>
                  <span className="text-[9px] opacity-60 truncate max-w-[160px]">{e.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
