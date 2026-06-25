"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useChat } from "../../hooks/useApi";
import { useChatContext } from "../../chat/ChatContext";
import { LIVE_SEGMENT_ID, type AgentEvent, type TraceSegment } from "./types";

/**
 * Derives the list of trace segments (one per assistant response) plus the
 * synthetic "live" segment for the in-flight run, and owns the interaction
 * state shared by the deck, pills, and expanded console across both hosts.
 *
 * History comes straight from the React Query `["chat", convId]` cache (the
 * same cache both hosts write to), so historical segments stay in sync without
 * either host reconstructing them.
 */
export function useTraceSegments(convId: string | undefined | null) {
  const { data: conv } = useChat(convId ?? undefined);
  const ctx = useChatContext();
  const { liveEvents, sending, activeSegmentId, setActiveSegmentId, unreadCount, setUnreadCount } = ctx;

  // ── Build historical segments from stored messages ──
  const messages = (conv as any)?.messages ?? [];

  const historical: TraceSegment[] = useMemo(() => {
    const out: TraceSegment[] = [];
    let assistantTurn = 0;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const events: AgentEvent[] = Array.isArray(m.agentEvents) && m.agentEvents.length
        ? m.agentEvents
        : [];
      if (events.length === 0) continue;
      assistantTurn++;
      // Label from the preceding user message if present.
      const prevUser = i > 0 ? messages[i - 1] : null;
      const userText = prevUser?.role === "user" ? String(prevUser.content ?? "").trim() : "";
      const snippet = userText ? userText.slice(0, 14) + (userText.length > 14 ? "…" : "") : "";
      out.push({
        id: m.id,
        label: snippet || `Turn ${assistantTurn}`,
        events,
        status: "done",
        turnIndex: assistantTurn,
      });
    }
    return out;
  }, [messages]);

  // ── Append the live segment if a run is in flight with events ──
  const segments: TraceSegment[] = useMemo(() => {
    if (sending && liveEvents.length > 0) {
      const last = historical[historical.length - 1];
      const turnIndex = (last?.turnIndex ?? 0) + 1;
      const label = last ? `Turn ${turnIndex}` : "Turn 1";
      return [...historical, { id: LIVE_SEGMENT_ID, label, events: liveEvents, status: "live" as const, turnIndex }];
    }
    return historical;
  }, [historical, sending, liveEvents]);

  const liveSegmentId: string | null = sending && liveEvents.length > 0 ? LIVE_SEGMENT_ID : null;

  // ── Auto-snap to live when a new send begins (and console is open) ──
  const prevSendingRef = useRef(false);
  const prevLiveLenRef = useRef(0);
  useEffect(() => {
    // A send just started (false → true): clear unread, follow live.
    if (sending && !prevSendingRef.current) {
      setActiveSegmentId(LIVE_SEGMENT_ID);
      setUnreadCount(0);
    }
    prevSendingRef.current = sending;
  }, [sending, setActiveSegmentId, setUnreadCount]);

  // ── Unread tracking: live events arrived while NOT viewing live ──
  useEffect(() => {
    if (!liveSegmentId) {
      prevLiveLenRef.current = 0;
      return;
    }
    const delta = liveEvents.length - prevLiveLenRef.current;
    prevLiveLenRef.current = liveEvents.length;
    if (delta > 0 && activeSegmentId !== LIVE_SEGMENT_ID) {
      setUnreadCount((c) => c + delta);
    }
  }, [liveEvents.length, liveSegmentId, activeSegmentId, setUnreadCount]);

  // ── Live → historical handoff: when the run finishes, migrate active id ──
  // from "live" to the newly-committed historical segment (last one), so the
  // view doesn't jump/clear. Use ref to detect the false→ just-finished edge.
  const prevSegmentsLenRef = useRef(segments.length);
  useEffect(() => {
    if (!sending && prevSendingRef.current === true) {
      // Run just ended. If the user was following live, park on the newest
      // historical segment (which is what "live" just became).
      if (activeSegmentId === LIVE_SEGMENT_ID) {
        const newest = historical[historical.length - 1];
        if (newest) setActiveSegmentId(newest.id);
      }
    }
    prevSegmentsLenRef.current = segments.length;
  }, [sending, historical, activeSegmentId, setActiveSegmentId, segments.length]);

  // Default active = newest segment (live if streaming, else last historical).
  useEffect(() => {
    if (activeSegmentId === null && segments.length > 0) {
      setActiveSegmentId(liveSegmentId ?? segments[segments.length - 1].id);
    }
  }, [segments, activeSegmentId, liveSegmentId, setActiveSegmentId]);

  const jumpToLive = useCallback(() => {
    if (!liveSegmentId) return;
    setActiveSegmentId(LIVE_SEGMENT_ID);
    setUnreadCount(0);
  }, [liveSegmentId, setActiveSegmentId, setUnreadCount]);

  const activeEvents: AgentEvent[] = useMemo(() => {
    const seg = segments.find((s) => s.id === activeSegmentId);
    return seg ? seg.events : [];
  }, [segments, activeSegmentId]);

  const selectSegment = useCallback((id: string) => {
    setActiveSegmentId(id);
  }, [setActiveSegmentId]);

  return {
    segments,
    activeSegmentId,
    liveSegmentId,
    unreadCount,
    activeEvents,
    jumpToLive,
    selectSegment,
  };
}

export type UseTraceSegmentsReturn = ReturnType<typeof useTraceSegments>;
