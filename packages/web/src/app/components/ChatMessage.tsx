"use client";

import { useState } from "react";
import BlockRenderer from "./BlockRenderer";
import MarkdownRenderer from "./MarkdownRenderer";
import { type AgentEvent, ToolUseCard, ToolResultCard, TextDeltaCard, formatTimestamp, AgentActivityFullscreen } from "./ProcessViewer";
import type { Block } from "@encarta/core";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min === 1) return "1 min ago";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return "1 hr ago";
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

interface ChatMessageProps {
  role: string;
  content: string;
  blocks?: Block[];
  createdAt?: string;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  agentEvents?: AgentEvent[];
}

function AgentEventCard({ event, onClick }: { event: AgentEvent; onClick?: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter") onClick?.(); }} className="rounded transition-opacity hover:opacity-80" style={{ cursor: "pointer" }}>
      <div className="flex items-center gap-1.5 text-[9px] mb-0.5" style={{ color: "#9aa0a6" }}>
        <span>{formatTimestamp(event.timestamp)}</span>
        <span className="font-semibold uppercase text-[8px] px-1 border rounded" style={{ borderColor: "#e0e0e0" }}>{event.type}</span>
      </div>
      {event.type === "tool_use" && <ToolUseCard data={event.data as any} />}
      {event.type === "tool_result" && <ToolResultCard data={event.data as any} />}
      {event.type === "text" && <TextDeltaCard data={event.data as any} />}
      {event.type === "status" && (
        <div className="text-[10px] font-semibold py-1 px-2.5 border-l-2 border-[var(--green)] rounded-r" style={{ background: "#f0fdf4" }}>
          ⚡ {String(event.data)}
        </div>
      )}
      {event.type === "error" && (
        <div className="text-[10px] font-semibold py-1 px-2.5 border-l-2 border-[var(--red)] rounded-r" style={{ background: "#fef2f2" }}>
          ❌ {String(event.data)}
        </div>
      )}
    </div>
  );
}

export default function ChatMessage({ role, content, blocks, createdAt, isLastAssistant, onRegenerate, onEdit, onCopy, agentEvents }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const [fullscreenEventIdx, setFullscreenEventIdx] = useState<number | undefined>(undefined);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const avatar = (
    <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full border-2 border-black text-base font-bold" style={{ background: isUser ? "var(--orange)" : "var(--blue)", color: "white" }}>
      {isUser ? "U" : "A"}
    </div>
  );

  const body = (
    <div className="w-fit max-w-[75%] group">
      <span className="pixel text-[11px] block mb-1.5" style={{ color: isUser ? "var(--orange)" : "var(--blue)" }}>
        {isUser ? "YOU" : "TRUTHSEEKER"}
      </span>
      {content && (
        <div className="leading-relaxed text-base">
          {isUser ? (
            <div className="px-4 py-3 rounded-2xl" style={{ background: "transparent", color: "var(--ink)" }}>
              {content}
            </div>
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>
      )}
      {blocks && blocks.length > 0 && (
        <div className="mt-3">
          <BlockRenderer blocks={blocks} compact />
        </div>
      )}

      {/* Agent activity (assistant messages only) */}
      {!isUser && agentEvents && agentEvents.length > 0 && (
        <div className="mt-3 pt-2 border-t" style={{ borderColor: "#e5e5e5" }}>
          <button
            onClick={() => setShowActivity(!showActivity)}
            className="flex items-center gap-1.5 text-[9px] font-semibold px-1 py-1 rounded hover:bg-[#f5f5f4] transition-colors"
            style={{ color: "#5f6368" }}
          >
            <span className="text-[8px]">{showActivity ? "▼" : "▶"}</span>
            Agent Activity
            <span className="text-[8px] ml-0.5 px-1.5 py-0.5 rounded-full border" style={{ borderColor: "#e0e0e0", color: "#9aa0a6" }}>
              {agentEvents.length}
            </span>
          </button>
          {showActivity && (
            <div className="mt-2 space-y-1">
              {agentEvents.map((event, i) => (
                <AgentEventCard key={`${event.timestamp}-${i}`} event={event} onClick={() => setFullscreenEventIdx(i)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className={`flex items-center gap-2 mt-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
        {createdAt && (
          <span className="text-[10px]" style={{ color: "#9aa0a6" }}>{timeAgo(createdAt)}</span>
        )}

        {/* Copy button (assistant messages) */}
        {!isUser && onCopy && (
          <button
            onClick={handleCopy}
            className="btn-ghost text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: copied ? "var(--green)" : "#9aa0a6" }}
            title="Copy message"
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        )}

        {/* Thumbs up/down (assistant messages) */}
        {!isUser && (
          <>
            <button
              onClick={() => setFeedback(feedback === "up" ? null : "up")}
              className="btn-ghost text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: feedback === "up" ? "var(--green)" : "#9aa0a6" }}
              title="Helpful"
            >
              👍
            </button>
            <button
              onClick={() => setFeedback(feedback === "down" ? null : "down")}
              className="btn-ghost text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: feedback === "down" ? "var(--red)" : "#9aa0a6" }}
              title="Not helpful"
            >
              👎
            </button>
          </>
        )}

        {/* Regenerate (last assistant only) */}
        {!isUser && isLastAssistant && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="btn-ghost text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#9aa0a6" }}
            title="Get a different response"
          >
            🔄 Regenerate
          </button>
        )}

        {/* Edit (user messages) */}
        {isUser && onEdit && (
          <button
            onClick={onEdit}
            className="btn-ghost text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#9aa0a6" }}
            title="Edit message"
          >
            ✏️ Edit
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className={`flex gap-3 px-6 py-4 ${isUser ? "flex-row-reverse" : ""}`}>
        {avatar}
        {body}
      </div>
      {agentEvents && agentEvents.length > 0 && (
        <AgentActivityFullscreen
          open={fullscreenEventIdx !== undefined}
          onClose={() => setFullscreenEventIdx(undefined)}
          events={agentEvents}
          scrollToIndex={fullscreenEventIdx}
        />
      )}
    </>
  );
}
