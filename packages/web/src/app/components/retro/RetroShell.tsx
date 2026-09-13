"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import RetroWindow from "./RetroWindow";

// ponytail: global retro shell — one nav tree for every non-article page. No per-page rewrites.
const NAV = [
  { href: "/articles", label: "Articles", icon: "📚" },
  { href: "/claim-graph", label: "Claim Graph", icon: "🕸️" },
  { href: "/contested", label: "Contested", icon: "⚖️" },
  { href: "/gaps", label: "Open Questions", icon: "❓" },
  { href: "/stale", label: "Stale Watch", icon: "🕰️" },
  { href: "/maps", label: "Maps", icon: "🗺️" },
  { href: "/chat/new", label: "Chat", icon: "💬" },
  { href: "/pricing", label: "Pricing", icon: "🏷️" },
  { href: "/admin", label: "Admin", icon: "🛠️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function RetroShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <RetroWindow title={`Microsoft Encarta Encyclopedia 98 - ${pathname}`} address={`encarta.msn.com${pathname}`} status="MS Encarta • Ready">
      <div className="r-side w-full lg:w-[270px] shrink-0 bg-[#e8e0c5] border-r-[2px] border-[#8a7f68] flex flex-col">
        <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 flex items-center justify-between"><span>Contents</span><span className="bg-[#c9a227] text-black px-1 text-[9px] border border-black">TREE</span></div>
        <div className="p-2 space-y-0.5 overflow-auto">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href.split("/").slice(0, 2).join("/"));
            return (
              <Link key={n.href} href={n.href} className={`w-full text-left px-1.5 py-1 text-[12px] flex items-start gap-1.5 border no-underline ${active ? "bg-[#0a2a5e] text-white border-[#0a2a5e]" : "bg-transparent border-transparent hover:bg-[#d6cfae] text-black"}`}>
                <span className="mt-0.5">{n.icon}</span><span className="flex-1 leading-[1.25]">{n.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-2 mx-2 border-[2px] bg-[#ffffe1] p-2" style={{ borderStyle: "outset", borderWidth: 2 }}>
          <div className="text-[10px] font-bold bg-[#c9a227] text-black px-1 inline-block border border-black mb-1">WORD OF THE DAY</div>
          <div className="text-[12px] font-bold" style={{ fontFamily: "Georgia" }}>pis·ci·vore</div>
          <div className="text-[10px] leading-[1.3] mt-0.5"><i>n.</i> Fish-eater.</div>
        </div>
        <div className="mt-auto p-2 flex gap-1">
          <button className="r-btn flex-1" onClick={() => router.back()}>◀ Back</button>
          <button className="r-btn flex-1" onClick={() => router.push("/article/new")}>✎ New</button>
        </div>
      </div>
      <div className="flex-1 min-w-0 bg-[#efe9d5] flex flex-col min-h-0">
        <div className="bg-white border-[3px] m-1.5 sm:m-2 flex-1 overflow-auto r-scroll min-h-0" style={{ borderStyle: "inset", borderColor: "#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
          <div className="max-w-[900px] mx-auto p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </RetroWindow>
  );
}
