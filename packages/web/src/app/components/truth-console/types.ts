import type { AgentEvent } from "../ProcessViewer";

export type { AgentEvent };

/**
 * A single assistant response's worth of tool calls, rendered as one
 * "page" in the Truth Console. Historical segments are derived from each
 * stored assistant message's `agentEvents`; the live segment is the
 * currently-streaming response (id "live").
 */
export interface TraceSegment {
  /** assistant message id, or "live" while streaming. */
  id: string;
  /** short label for the segment pill (turn snippet / "Turn N"). */
  label: string;
  /** this response's events — order preserved so tool_result adjacency still pairs with its tool_use. */
  events: AgentEvent[];
  status: "live" | "done" | "error";
  turnIndex: number;
}

/** The synthetic id used for the in-flight (streaming) segment. */
export const LIVE_SEGMENT_ID = "live";
