"use client";

import { useEffect } from "react";

// Global scroll-reveal driver. `.reveal-blur` elements start invisible
// (opacity 0) until `in-view` is added — that used to happen only in the
// landing page's local hook, so every other route using reveal classes
// (chat empty state, claim-graph, …) rendered permanently blank yet still
// clickable. Mounted once in the root layout; a MutationObserver re-arms
// async-rendered content (pathname snapshot alone misses it).
const SEL = ".reveal, .reveal-up, .reveal-blur, .scrub-text, .stack-card, .scale-fade-img";

export default function ScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    const arm = () => {
      document.querySelectorAll(SEL).forEach((el) => {
        const h = el as HTMLElement;
        if (!h.dataset.revealArmed && !h.classList.contains("in-view")) {
          h.dataset.revealArmed = "1";
          io.observe(el);
        }
      });
    };
    arm();
    // rAF-batched: chat streaming re-renders constantly; rescan at most
    // once per frame and only for elements added since last scan.
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(arm);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
