"use client";

import Link from "next/link";

export default function TruthseekersLogo({ size = "default" }: { size?: "small" | "default" }) {
  const isSmall = size === "small";
  
  return (
    <Link href="/" className="flex items-center gap-2 group" style={{ textDecoration: "none" }}>
      <div 
        className={`flex items-center justify-center font-bold text-white border-2 border-[#1a1a1a] rounded-lg shadow-[2px_2px_0_#1a1a1a] ${isSmall ? 'w-8 h-8 text-[8px]' : 'w-10 h-10 text-[10px]'}`}
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        <span className="text-[#ea580c]">T</span>
        <span className="text-[#0c4a6e]">S</span>
      </div>
      <span className={`font-bold tracking-tight text-[#1a1a1a] group-hover:text-[#ea580c] transition-colors ${isSmall ? 'text-base' : 'text-xl'}`}>
        Truthseekers
      </span>
      </Link>
  );
}
