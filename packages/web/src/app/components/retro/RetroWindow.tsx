"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./retro98.css";
import RetroNavStrip from "./RetroNavStrip";
import { crumbLabel } from "@/lib/routes";
import { useRetroTheme, type RetroStyleMode } from "@/lib/retroTheme";
import { retroAudio } from "@/lib/retroAudio";

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    try { setOnline(navigator.onLine); } catch {}
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export default function RetroWindow({ title, children, status, path, crumb, nav, fixed }: { title: string; children: React.ReactNode; status: string; path?: string; crumb?: string; nav?: boolean; fixed?: boolean }) {
  const pathname = usePathname();
  const online = useOnline();
  const [theme, setTheme] = useRetroTheme();

  const p = path ?? pathname ?? "/";
  const segs = p.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string | null }> = [{ label: "TruthSeekers", href: "/" }];
  segs.forEach((s, i) => {
    const href = "/" + segs.slice(0, i + 1).join("/");
    const last = i === segs.length - 1;
    crumbs.push({ label: last && crumb ? crumb : crumbLabel(s), href: last ? null : href });
  });

  const themeClass = theme === "win98" ? "retro-win98" : theme === "vintage" ? "retro-vintage" : "retro-hybrid";

  return (
    <div className={`retro98 ${themeClass} min-h-dvh p-1 sm:p-2.5 transition-colors duration-200`} style={{ background: "var(--r-bg)" }}>
      {/* ponytail: fixed pins the shell to the viewport so an inner column
          (e.g. chat messages) becomes the only scroller. */}
      <div className={`r-window w-full flex flex-col ${fixed ? "h-[calc(100dvh-20px)]" : "min-h-[calc(100dvh-20px)]"}`}>
        {/* Titlebar */}
        <div className="r-title flex items-center justify-between px-2 select-none shrink-0 gap-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-2 text-white text-[12px] font-bold min-w-0">
            <Link href="/" aria-label="TruthSeekers home" className="flex items-center shrink-0 no-underline hover:opacity-85 transition-opacity">
              <img src="/logo-icon.png" alt="TruthSeekers Logo" className="w-[18px] h-[18px] object-contain shrink-0" />
            </Link>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 overflow-hidden text-[12px]">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                const first = i === 0;
                const hideMobile = !first && !last ? "hidden sm:flex" : "";
                return (
                  <span key={i} className={`flex items-center gap-1 min-w-0 ${hideMobile}`}>
                    {i > 0 && <span aria-hidden className="opacity-50 shrink-0">/</span>}
                    {c.href ? (
                      <Link href={c.href} className="hover:underline truncate max-w-[90px] sm:max-w-[150px]" style={{ color: "var(--r-title-text)", opacity: 0.9 }}>
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="truncate max-w-[140px] sm:max-w-[220px] font-semibold" title={c.label} style={{ color: "var(--r-title-text)" }}>
                        {c.label}
                      </span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          <div className="flex gap-1.5 items-center shrink-0">

            <button
              onClick={() => {
                retroAudio.toggle();
                retroAudio.playClick();
              }}
              aria-label="Toggle retro sound FX"
              title="Toggle retro CD-ROM sound effects"
              className="h-[22px] px-1.5 bg-[var(--r-header-accent)] text-black text-[10px] font-bold border border-black hover:brightness-110 cursor-pointer rounded-sm"
            >
              🔊 Audio
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent("retro-palette-open"))}
              aria-label="Go to a page (Ctrl+K)"
              title="Go to… (Ctrl+K)"
              className="h-[22px] px-2 bg-[var(--r-header-accent)] text-black text-[10px] font-bold border border-black hover:brightness-110 cursor-pointer"
            >
              Go to…
            </button>

          </div>
        </div>

        {nav && <RetroNavStrip />}

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2.5 p-2 sm:p-3">{children}</div>

        {/* Statusbar */}
        <div className="min-h-[22px] bg-[var(--r-nav-bg)] border-t border-[var(--r-border)] flex items-center px-3 text-[10px] gap-3 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)", color: "var(--r-ink-secondary)" }}>
          <span className="border px-2 py-0.5 bg-[var(--r-surface)] shrink-0 font-medium" style={{ borderColor: "var(--r-border)" }}>
            {online ? "● Online" : "○ Offline"}
          </span>
          <span className="hidden sm:inline opacity-70">Ctrl+K to search/navigate</span>
          <span className="ml-auto truncate min-w-0 flex-1 text-right font-medium">{online ? status : "Offline — cached reads only"}</span>
        </div>
      </div>
    </div>
  );
}
