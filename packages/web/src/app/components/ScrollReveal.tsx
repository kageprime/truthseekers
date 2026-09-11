"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Global scroll-reveal driver. `.reveal-blur` elements start invisible
// (opacity 0) until `in-view` is added — that used to happen only in the
// landing page's local hook, so every other route using reveal classes
// (chat empty state, claim-graph, …) rendered permanently blank yet still
// clickable. Mounted once in the root layout; re-arms on every navigation.
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document
      .querySelectorAll(".reveal, .reveal-up, .reveal-blur, .scrub-text, .stack-card, .scale-fade-img")
      .forEach((el) => {
        if (!el.classList.contains("in-view") && !el.classList.contains("reveal-visible")) {
          observer.observe(el);
        }
      });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
