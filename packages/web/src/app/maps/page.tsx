"use client";

import dynamic from "next/dynamic";

const AtlasMap = dynamic(() => import("../components/AtlasAntiquaMap"), { ssr: false });

// ponytail: map in an inset viewport with a navy coordinates bar. Back lives in the sidebar.
export default function MapsPage() {
  return (
    <>
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">Atlas • Territories</div>
        <h1 className="r-h1 mt-1" style={{ fontSize: 28 }}>Maps</h1>
        <p className="text-[11px] mt-1" style={{ color: "#555" }}>
          Every mapped article, plotted and explorable.
        </p>
      </div>
      <div className="border-[3px] bg-[#d4d0c8]" style={{ borderStyle: "outset", borderColor: "#fff8e0 #8a7f68 #8a7f68 #fff8e0" }}>
        <div className="bg-[#0a2a5e] text-white text-[11px] font-bold px-2 py-1 flex items-center justify-between">
          <span>TruthSeekers Atlas</span>
          <span className="bg-[#c9a227] text-black px-1 text-[9px] border border-black">INTERACTIVE</span>
        </div>
        <div className="border-[3px] m-1.5 min-h-[60vh]" style={{ borderStyle: "inset", borderColor: "#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
          <AtlasMap />
        </div>
      </div>
    </>
  );
}
