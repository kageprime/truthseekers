"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_GROUPS, RETRO_ROUTES } from "@/lib/routes";
import { IconBack, IconBook, IconChat, IconClock, IconGear, IconGraph, IconHome, IconList, IconMap, IconPencil, IconQuestion, IconScale, IconTag, IconWrench } from "./icons";

// ponytail: single contents nav — sidebar tree on desktop, collapsed toggle on mobile. Every list page renders this.
const ICONS: Record<string, (p: { size?: number }) => React.ReactNode> = {
  home: IconHome, book: IconBook, graph: IconGraph, scale: IconScale, question: IconQuestion,
  clock: IconClock, map: IconMap, chat: IconChat, tag: IconTag, wrench: IconWrench,
  gear: IconGear, pencil: IconPencil, list: IconList,
};

export default function RetroContentsNav({ pathname, showAdmin }: { pathname: string; showAdmin: boolean }) {
  const router = useRouter();
  // ponytail: collapsed on small screens — the tree no longer shoves content down.
  const [treeOpen, setTreeOpen] = useState(false);
  return (
    <div className="r-side w-full lg:w-[270px] shrink-0 bg-[#e8e0c5] border-r-[2px] border-[#8a7f68] flex flex-col">
      <button
        className="lg:hidden bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 flex items-center justify-between w-full"
        onClick={() => setTreeOpen((o) => !o)}
        aria-expanded={treeOpen}
        aria-controls="retro-contents"
      >
        <span>Contents</span><span aria-hidden>{treeOpen ? "▾" : "▸"}</span>
      </button>
      <div className="hidden lg:flex bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 items-center justify-between"><span>Contents</span><span className="bg-[#c9a227] text-black px-1 text-[9px] border border-black">TREE</span></div>
      <nav id="retro-contents" className={`${treeOpen ? "block" : "hidden"} lg:block p-2 space-y-2 overflow-auto`} aria-label="Site contents">
        {NAV_GROUPS.map((g) => (
          <div key={g}>
            <div className="text-[9px] font-bold tracking-widest uppercase px-1.5 pb-0.5" style={{ color: "#8a7f68" }}>{g}</div>
            <div className="space-y-0.5">
              {RETRO_ROUTES.filter((r) => r.group === g && !r.hideInNav && (!r.adminOnly || showAdmin)).map(({ href, label, icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                const Icon = ICONS[icon] ?? IconBook;
                return (
                  <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setTreeOpen(false)} className={`w-full text-left px-1.5 py-1 text-[12px] flex items-center gap-1.5 border no-underline ${active ? "bg-[#0a2a5e] text-white border-[#0a2a5e]" : "bg-transparent border-transparent hover:bg-[#d6cfae] text-black"}`} style={active ? { color: "#fff" } : undefined}>
                    <span className="inline-flex shrink-0" aria-hidden><Icon size={14} /></span><span className="flex-1 leading-[1.25]">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-2 mx-2 border-[2px] bg-[#ffffe1] p-2 hidden lg:block" style={{ borderStyle: "outset", borderWidth: 2 }}>
        <div className="text-[10px] font-bold bg-[#c9a227] text-black px-1 inline-block border border-black mb-1">WORD OF THE DAY</div>
        <div className="text-[12px] font-bold" style={{ fontFamily: "Georgia" }}>pis·ci·vore</div>
        <div className="text-[10px] leading-[1.3] mt-0.5"><i>n.</i> Fish-eater.</div>
      </div>
      <div className="mt-auto p-2 flex gap-1">
        <button className="r-btn flex-1 inline-flex items-center justify-center gap-1" onClick={() => router.back()} aria-label="Go back"><IconBack size={12} /> Back</button>
        <button className="r-btn flex-1 inline-flex items-center justify-center gap-1" onClick={() => router.push("/article/new")} aria-label="Write a new article"><IconPencil size={12} /> New</button>
      </div>
    </div>
  );
}
