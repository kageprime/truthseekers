"use client";

import { useEffect, useState } from "react";

export function useIntersectionToc(selector: string = "[data-section-id]") {
  const [visibleSections, setVisibleSections] = useState<string[]>([]);

  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;

    const visibleMap = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-section-id");
          if (id) {
            visibleMap.set(id, entry.isIntersecting);
          }
        });

        const active = Array.from(visibleMap.entries())
          .filter(([, isIntersecting]) => isIntersecting)
          .map(([id]) => id);

        setVisibleSections(active);
      },
      {
        rootMargin: "-80px 0px -40% 0px",
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [selector]);

  return visibleSections;
}
