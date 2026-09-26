"use client";

import { useEffect, useState } from "react";

// ponytail: last heading above viewport+6rem — single active, no double-glow.
export function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!ids.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const offset = window.innerHeight * 0 + 96; // viewport top + 6rem
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = id;
        else break;
      }
      setActive(current ?? ids[0] ?? null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids.join("|")]);
  return active;
}
