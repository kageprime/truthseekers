"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface UseAutoScrollOptions {
  enabled?: boolean;
  idleGrace?: number; // ms to keep auto-scroll alive after streaming stops
}

export function useAutoScroll(scrollContainerRef: React.RefObject<HTMLDivElement | null>, options?: UseAutoScrollOptions) {
  const { enabled = true, idleGrace = 1500 } = options ?? {};
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const userScrolledUpRef = useRef(false);
  const lastUserScroll = useRef(0);
  const lastContentHeight = useRef(0);

  // Expose a toggle so the user sees a FAB
  const [showFab, setShowFab] = useState(false);

  // Detect user scroll intent
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If user scrolled up more than 300px from bottom, mark as manual
    if (distanceFromBottom > 300) {
      if (!userScrolledUpRef.current) {
        userScrolledUpRef.current = true;
        setShowFab(true);
      }
      lastUserScroll.current = Date.now();
    } else {
      userScrolledUpRef.current = false;
      setShowFab(false);
    }
  }, [scrollContainerRef]);

  // Attach scroll listener
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef, handleScroll]);

  // RAF loop during streaming: follow content growth
  const follow = useCallback(() => {
    const el = scrollContainerRef.current;
    const spacer = spacerRef.current;
    if (!el || !spacer) return;

    const contentHeight = el.scrollHeight - spacer.offsetHeight;
    const growth = contentHeight - lastContentHeight.current;

    // Shrink spacer by the amount content grew, so scrollHeight stays constant
    if (growth > 0) {
      const newSpacer = Math.max(0, spacer.offsetHeight - growth);
      spacer.style.height = `${newSpacer}px`;

      // If the spacer is exhausted, actually scroll down
      if (newSpacer === 0) {
        el.scrollTop = el.scrollHeight;
      }
    }

    lastContentHeight.current = contentHeight;
    rafRef.current = requestAnimationFrame(follow);
  }, [scrollContainerRef]);

  // Start/stop RAF
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!enabled || !isStreaming) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    // Capture starting scroll height and spacer
    const spacer = spacerRef.current;
    if (spacer) {
      const viewportHeight = el.clientHeight;
      spacer.style.height = `${viewportHeight}px`;
    }
    lastContentHeight.current = el.scrollHeight - (spacer?.offsetHeight ?? 0);
    el.scrollTop = el.scrollHeight;

    rafRef.current = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, isStreaming, scrollContainerRef, follow]);

  // Jump-to-bottom
  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    userScrolledUpRef.current = false;
    setShowFab(false);
  }, [scrollContainerRef]);

  return {
    spacerRef,
    showFab,
    scrollToBottom,
    setIsStreaming,
    isStreaming,
  };
}
