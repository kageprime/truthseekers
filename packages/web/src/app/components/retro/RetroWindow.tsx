"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./retro98.css";
import RetroNavStrip from "./RetroNavStrip";
import { crumbLabel } from "@/lib/routes";

// ponytail: chrome is titlebar (home badge + breadcrumb trail) + optional nav strip + content + statusbar.
export default function RetroWindow({ title, children, status, path, crumb, nav }: { title: string; children: React.ReactNode; status: string; path?: string; crumb?: string; nav?: boolean }) {
  const pathname = usePathname();
  const p = path ?? pathname ?? "/";
  const segs = p.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string | null }> = [{ label: "TruthSeekers", href: "/" }];
  segs.forEach((s, i) => {
    const href = "/" + segs.slice(0, i + 1).join("/");
    const last = i === segs.length - 1;
    crumbs.push({ label: last && crumb ? crumb : crumbLabel(s), href: last ? null : href });
  });
  return (
    <div className="retro98 min-h-screen p-1 sm:p-2" style={{ background: "#c3bda8" }}>
      <div className="r-window w-full flex flex-col min-h-[calc(100vh-16px)]">
        <div className="r-title flex items-center justify-between px-1 select-none shrink-0 gap-2">
          <div className="flex items-center gap-1.5 text-white text-[12px] font-bold min-w-0">
            <Link href="/" aria-label="TruthSeekers home" className="w-[16px] h-[14px] bg-[#c9a227] border border-black flex items-center justify-center text-[10px] text-black font-bold shrink-0 no-underline hover:bg-[#e3bd3a] active:border-white" style={{ textDecoration: "none" }}>TS</Link>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 text-[12px]">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <span aria-hidden className="opacity-60 shrink-0">▸</span>}
                  {c.href ? (
                    <Link href={c.href} className="underline underline-offset-2 truncate max-w-[140px] sm:max-w-none" style={{ color: "#fff", textDecorationColor: "rgba(255,255,255,.5)" }}>{c.label}</Link>
                  ) : (
                    <span aria-current="page" className="truncate max-w-[200px] sm:max-w-none text-white" title={c.label}>{c.label}</span>
                  )}
                </span>
              ))}
              <span className="opacity-0 absolute" aria-hidden>{title}</span>
            </nav>
          </div>
          <div className="flex gap-0.5" aria-hidden>{["_","□","X"].map((c) => <div key={c} className="w-[16px] h-[14px] bg-[#d4d0c8] text-[10px] leading-[12px] text-black flex items-center justify-center font-bold" style={{ borderStyle:"outset",borderWidth:1,borderColor:"white #404040 #404040 white" }}>{c}</div>)}</div>
        </div>
        {nav && <RetroNavStrip />}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2 p-2">{children}</div>
        <div className="h-[18px] bg-[#d4d0c8] border-t-[2px] border-[#808080] flex items-center px-2 text-[10px] gap-3 shrink-0">
          <span className="border px-2 py-0 bg-[#efe9d5]" style={{ borderStyle:"inset",borderWidth:1 }}>Ready</span>
          <span className="hidden sm:inline opacity-60">Ctrl+K to navigate</span>
          <span className="ml-auto truncate">{status}</span>
        </div>
      </div>
    </div>
  );
}
