"use client";
import "./retro98.css";

// ponytail: one chrome wrapper — title/menu/toolbar/status exact to spec.
export default function RetroWindow({ title, address, children, status }: { title: string; address: string; children: React.ReactNode; status: string }) {
  return (
    <div className="retro98 min-h-screen p-0 sm:p-3" style={{ background: "#c3bda8" }}>
      <div className="r-window mx-auto max-w-[1440px] flex flex-col min-h-[calc(100vh-24px)]">
        <div className="r-title flex items-center justify-between px-1 select-none shrink-0">
          <div className="flex items-center gap-1.5 text-white text-[12px] font-bold">
            <span className="w-[16px] h-[14px] bg-[#c9a227] border border-black flex items-center justify-center text-[10px] text-black">e</span>
            {title}
          </div>
          <div className="flex gap-0.5">{["_","□","X"].map((c) => <div key={c} className="w-[16px] h-[14px] bg-[#d4d0c8] text-[10px] leading-[12px] text-black flex items-center justify-center font-bold" style={{ borderStyle:"outset",borderWidth:1,borderColor:"white #404040 #404040 white" }}>{c}</div>)}</div>
        </div>
        <div className="r-menu flex items-center gap-4 px-2 shrink-0">
          <span><u>F</u>ile</span><span><u>E</u>dit</span><span><u>V</u>iew</span><span><u>G</u>o</span><span><u>H</u>elp</span>
          <span className="ml-auto text-[10px] opacity-60">© 1993-1998 Microsoft Corporation</span>
        </div>
        <div className="r-toolbar p-1 flex items-center gap-1 shrink-0 flex-wrap">
          {["◀ Back","⟲ History","⎙ Copy","🔍 Find"].map((l) => <button key={l} className="r-btn">{l}</button>)}
          <span className="ml-2 bg-white border px-2 py-[1px] min-w-[260px] sm:min-w-[340px] text-[11px] flex items-center gap-1" style={{ borderStyle:"inset",borderWidth:2 }}><span className="opacity-50">📍</span>{address}</span>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">{children}</div>
        <div className="h-[18px] bg-[#d4d0c8] border-t-[2px] border-[#808080] flex items-center px-2 text-[10px] gap-3 shrink-0">
          <span className="border px-2 py-0 bg-[#efe9d5]" style={{ borderStyle:"inset",borderWidth:1 }}>Ready</span>
          <span className="ml-auto">{status}</span>
        </div>
      </div>
    </div>
  );
}
