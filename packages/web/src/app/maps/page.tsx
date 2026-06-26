"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const AtlasMap = dynamic(() => import("../components/AtlasAntiquaMap"), { ssr: false });

export default function MapsPage() {
  return (
    <>
      <Link
        href="/"
        className="fixed top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded cursor-pointer no-underline"
        style={{
          background: 'radial-gradient(circle at 20% 15%, #f0e0c0 0%, #d9c7a1 35%, #c8b188 100%)',
          border: '1.5px solid #7a512f',
          color: '#2a1d0f',
          fontFamily: "'IM Fell English', serif",
          boxShadow: '0 4px 12px rgba(0,0,0,.4)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        Back
      </Link>
      <AtlasMap />
    </>
  );
}
