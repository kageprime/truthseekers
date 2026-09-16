"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./retro98.css";
import "./7css.css";
import RetroNavStrip from "./RetroNavStrip";
import { crumbLabel } from "@/lib/routes";
import { useRetroTheme, type RetroStyleMode } from "@/lib/retroTheme";
import { useUiSettings } from "../../context/UiSettingsContext";

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
  const [theme] = useRetroTheme();
  const { settings } = useUiSettings();

  const p = path ?? pathname ?? "/";
  const segs = p.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string | null }> = [{ label: "TruthSeekers", href: "/" }];
  segs.forEach((s, i) => {
    const href = "/" + segs.slice(0, i + 1).join("/");
    const last = i === segs.length - 1;
    crumbs.push({ label: last && crumb ? crumb : crumbLabel(s), href: last ? null : href });
  });

  const themeClass =
    theme === "win7"
      ? "retro-win7"
      : theme === "win98"
      ? "retro-win98"
      : theme === "vintage"
      ? "retro-vintage"
      : "retro-hybrid";

  const isBarebones = !settings.showWindowFrame;

  return (
    <div
      className={`retro98 ${themeClass} min-h-dvh ${isBarebones ? "p-0 bg-transparent" : "p-0 sm:p-2.5"} transition-colors duration-200`}
      style={{ background: isBarebones ? "transparent" : "var(--r-bg)" }}
    >
      {/* Full-bleed on mobile, classic window frame on tablet/desktop */}
      <div
        className={`r-window w-full flex flex-col ${
          isBarebones ? "border-0 shadow-none bg-transparent rounded-none" : "border-0 sm:border"
        } ${fixed ? "h-dvh sm:h-[calc(100dvh-20px)]" : "min-h-dvh sm:min-h-[calc(100dvh-20px)]"}`}
      >
        {/* Optional Titlebar */}
        {settings.showTitleBar && !isBarebones && (
          <div
            className="r-title flex items-center justify-between px-3 select-none shrink-0 gap-2 min-h-[30px]"
            style={{ paddingTop: "max(4px, env(safe-area-inset-top))" }}
          >
            <div className="flex items-center gap-2 text-white text-[12px] font-bold min-w-0">
              <Link href="/" className="hover:opacity-80 flex items-center gap-1.5 no-underline" style={{ color: "var(--r-title-text)" }}>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                <span className="truncate">{title}</span>
              </Link>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block opacity-70" />
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block opacity-70" />
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block opacity-80" />
            </div>
          </div>
        )}

        {nav && <RetroNavStrip />}

        {/* Content canvas */}
        <div className={`flex-1 flex flex-col lg:flex-row min-h-0 gap-1.5 sm:gap-2.5 ${isBarebones ? "p-2 sm:p-4" : "p-1 sm:p-3"} ${p.startsWith("/chat/") && p !== "/chat/new" ? "pb-0 md:pb-3" : "pb-14 md:pb-3"}`}>
          {children}
        </div>

        {/* Statusbar - desktop only */}
        {settings.showStatusBar && !isBarebones && (
          <div className="hidden sm:flex min-h-[22px] bg-[var(--r-nav-bg)] border-t border-[var(--r-border)] items-center px-3 text-[10px] gap-3 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)", color: "var(--r-ink-secondary)" }}>
            <span className="border px-2 py-0.5 bg-[var(--r-surface)] shrink-0 font-medium" style={{ borderColor: "var(--r-border)" }}>
              {online ? "● Online" : "○ Offline"}
            </span>
            <span className="hidden sm:inline opacity-70">Ctrl+Shift+U for UI Scaffold Controller</span>
            <span className="ml-auto truncate min-w-0 flex-1 text-right font-medium">{online ? status : "Offline — cached reads only"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
