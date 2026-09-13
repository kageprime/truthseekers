"use client";
import { useRouter } from "next/navigation";
import "./retro98.css";
import { IconBack, IconCopy, IconFwd, IconPin, IconReload } from "./icons";

// ponytail: one chrome wrapper — full-bleed, live host, toolbar buttons real and labelled.
export default function RetroWindow({ title, path, children, status }: { title: string; path: string; children: React.ReactNode; status: string }) {
  const router = useRouter();
  const host = typeof window !== "undefined" && window.location.host ? window.location.host : "truthseekers.app";
  const address = `${host}${path}`;
  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(window.location.href); }
    catch { /* clipboard unavailable — no-op */ }
  };
  return (
    <div className="retro98 min-h-screen p-1 sm:p-2" style={{ background: "#c3bda8" }}>
      <div className="r-window w-full flex flex-col min-h-[calc(100vh-16px)]">
        <div className="r-title flex items-center justify-between px-1 select-none shrink-0">
          <div className="flex items-center gap-1.5 text-white text-[12px] font-bold min-w-0">
            <span className="w-[16px] h-[14px] bg-[#c9a227] border border-black flex items-center justify-center text-[10px] text-black font-bold shrink-0" aria-hidden>TS</span>
            <span className="truncate">{title}</span>
          </div>
          <div className="flex gap-0.5" aria-hidden>{["_","□","X"].map((c) => <div key={c} className="w-[16px] h-[14px] bg-[#d4d0c8] text-[10px] leading-[12px] text-black flex items-center justify-center font-bold" style={{ borderStyle:"outset",borderWidth:1,borderColor:"white #404040 #404040 white" }}>{c}</div>)}</div>
        </div>
        <nav className="r-menu flex items-center gap-4 px-2 shrink-0" aria-label="Application">
          <span><u>F</u>ile</span><span><u>E</u>dit</span><span><u>V</u>iew</span><span><u>G</u>o</span><span><u>H</u>elp</span>
          <span className="ml-auto text-[10px] opacity-60">© TruthSeekers</span>
        </nav>
        <div className="r-toolbar p-1 flex items-center gap-1 shrink-0 flex-wrap">
          <button className="r-btn inline-flex items-center gap-1" onClick={() => router.back()} aria-label="Go back" title="Back"><IconBack size={12} /> Back</button>
          <button className="r-btn inline-flex items-center gap-1" onClick={() => router.forward()} aria-label="Go forward" title="Forward"><IconFwd size={12} /> Forward</button>
          <button className="r-btn inline-flex items-center gap-1" onClick={() => router.refresh()} aria-label="Reload page" title="Reload"><IconReload size={12} /> Reload</button>
          <button className="r-btn inline-flex items-center gap-1" onClick={copyAddress} aria-label="Copy page address" title="Copy address"><IconCopy size={12} /> Copy</button>
          <span className="ml-2 bg-white border px-2 py-[1px] min-w-[200px] sm:min-w-[320px] text-[11px] flex items-center gap-1 text-black" style={{ borderStyle:"inset",borderWidth:2 }}><span className="opacity-50 inline-flex" aria-hidden><IconPin size={12} /></span><span className="truncate">{address}</span></span>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2 p-2">{children}</div>
        <div className="h-[18px] bg-[#d4d0c8] border-t-[2px] border-[#808080] flex items-center px-2 text-[10px] gap-3 shrink-0">
          <span className="border px-2 py-0 bg-[#efe9d5]" style={{ borderStyle:"inset",borderWidth:1 }}>Ready</span>
          <span className="ml-auto truncate">{status}</span>
        </div>
      </div>
    </div>
  );
}
