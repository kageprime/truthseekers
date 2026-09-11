"use client";

import { useEffect } from "react";

// Registers the service worker once. Update flow is passive: the new worker
// activates on next navigation (skipWaiting + clients.claim in sw.js), so no
// reload prompt is needed for a reading app.
export default function RegisterSw() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline-first is progressive enhancement; a failed registration
        // must never break the app.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
