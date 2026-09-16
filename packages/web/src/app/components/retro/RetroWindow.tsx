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
    <div className={`retro98 ${themeClass} min-h-dvh p-0 sm:p-2.5 transition-colors duration-200`} style={{ background: "var(--r-bg)" }}>
      {/* Full-bleed on mobile, classic window frame on tablet/desktop */}
      <div className={`r-window w-full flex flex-col border-0 sm:border ${fixed ? "h-dvh sm:h-[calc(100dvh-20px)]" : "min-h-dvh sm:min-h-[calc(100dvh-20px)]"}`}>
        {nav && <RetroNavStrip />}

        {/* ponytail: no tab-bar offset in chat thread (tab hides there) — everywhere else reserves pb-14. */}
        <div className={`flex-1 flex flex-col lg:flex-row min-h-0 gap-1.5 sm:gap-2.5 p-1 sm:p-3 ${p.startsWith("/chat/") && p !== "/chat/new" ? "pb-0 md:pb-3" : "pb-14 md:pb-3"}`}>{children}</div>

        {/* Statusbar - desktop only */}
        <div className="hidden sm:flex min-h-[22px] bg-[var(--r-nav-bg)] border-t border-[var(--r-border)] items-center px-3 text-[10px] gap-3 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)", color: "var(--r-ink-secondary)" }}>
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
