"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./retro98.css";
import RetroNavStrip from "./RetroNavStrip";
import { crumbLabel } from "@/lib/routes";

// ponytail: online probe for the statusbar — PWA users on flaky signal see it in the chrome.
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

// ponytail: chrome is titlebar (home badge + breadcrumb trail + Go-to…) + optional nav strip + content + statusbar.
export default function RetroWindow({ title, children, status, path, crumb, nav }: { title: string; children: React.ReactNode; status: string; path?: string; crumb?: string; nav?: boolean }) {
  const pathname = usePathname();
  const online = useOnline();
  const p = path ?? pathname ?? "/";
  const segs = p.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string | null }> = [{ label: "TruthSeekers", href: "/" }];
  segs.forEach((s, i) => {
    const href = "/" + segs.slice(0, i + 1).join("/");
    const last = i === segs.length - 1;
    crumbs.push({ label: last && crumb ? crumb : crumbLabel(s), href: last ? null : href });
  });
  return (
    <div className="retro98 min-h-dvh p-1 sm:p-2" style={{ background: "#c3bda8" }}>
      <div className="r-window w-full flex flex-col min-h-[calc(100dvh-16px)]">
        <div className="r-title flex items-center justify-between px-1 select-none shrink-0 gap-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-1.5 text-white text-[12px] font-bold min-w-0">
            <Link href="/" aria-label="TruthSeekers home" className="w-[16px] h-[14px] bg-[#c9a227] border border-black flex items-center justify-center text-[10px] text-black font-bold shrink-0 no-underline hover:bg-[#e3bd3a] active:border-white" style={{ textDecoration: "none" }}>TS</Link>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 overflow-hidden text-[12px]">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                const first = i === 0;
                // ponytail: middle crumbs collapse on mobile — first + current survive at 360px.
                const hideMobile = !first && !last ? "hidden sm:flex" : "";
                return (
                <span key={i} className={`flex items-center gap-1 min-w-0 ${hideMobile}`}>
                  {i > 0 && <span aria-hidden className="opacity-60 shrink-0">▸</span>}
                  {c.href ? (
                    <Link href={c.href} className="underline underline-offset-2 truncate max-w-[80px] sm:max-w-[140px]" style={{ color: "#fff", textDecorationColor: "rgba(255,255,255,.5)" }}>{c.label}</Link>
                  ) : (
                    <span aria-current="page" className="truncate max-w-[140px] sm:max-w-[200px] text-white" title={c.label}>{c.label}</span>
                  )}
                </span>
                );
              })}
              <span className="opacity-0 absolute" aria-hidden>{title}</span>
            </nav>
          </div>
          <div className="flex gap-0.5 items-center shrink-0" aria-hidden={false}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("retro-palette-open"))}
              aria-label="Go to a page (Ctrl+K)"
              title="Go to… (Ctrl+K)"
              className="h-[22px] min-w-[44px] px-1.5 bg-[#c9a227] text-black text-[10px] font-bold border border-black hover:bg-[#e3bd3a] cursor-pointer"
              style={{ borderStyle: "outset", borderWidth: 1, borderColor: "white #404040 #404040 white" }}
            >
              Go to…
            </button>
            <div className="flex gap-0.5" aria-hidden>{["_","□","X"].map((c) => <div key={c} className="w-[16px] h-[14px] bg-[#d4d0c8] text-[10px] leading-[12px] text-black flex items-center justify-center font-bold" style={{ borderStyle:"outset",borderWidth:1,borderColor:"white #404040 #404040 white" }}>{c}</div>)}</div>
          </div>
        </div>
        {nav && <RetroNavStrip />}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2 p-2">{children}</div>
        <div className="min-h-[18px] bg-[#d4d0c8] border-t-[2px] border-[#808080] flex items-center px-2 text-[10px] gap-3 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <span className="border px-2 py-0 bg-[#efe9d5] shrink-0" style={{ borderStyle:"inset",borderWidth:1 }}>{online ? "Ready" : "Offline"}</span>
          <span className="hidden sm:inline opacity-60">Ctrl+K to navigate</span>
          <span className="ml-auto truncate min-w-0 flex-1 text-right">{online ? status : "Offline — cached reads only"}</span>
        </div>
      </div>
    </div>
  );
}
