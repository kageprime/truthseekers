"use client";
import "./retro98.css";

// ponytail: chrome is titlebar + content + statusbar only. Nav lives in the sidebar.
export default function RetroWindow({ title, children, status }: { title: string; children: React.ReactNode; status: string }) {
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
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2 p-2">{children}</div>
        <div className="h-[18px] bg-[#d4d0c8] border-t-[2px] border-[#808080] flex items-center px-2 text-[10px] gap-3 shrink-0">
          <span className="border px-2 py-0 bg-[#efe9d5]" style={{ borderStyle:"inset",borderWidth:1 }}>Ready</span>
          <span className="ml-auto truncate">{status}</span>
        </div>
      </div>
    </div>
  );
}
