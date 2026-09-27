"use client";

import { useEffect, useState } from "react";

/**
 * useMediaQuery — SSR-safe breakpoint hook. Starts false on the server and
 * first paint, then tracks the live match. Used to decide whether a panel
 * docks into the right rail (≥xl) or floats as an overlay below it.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);

  return matches;
}