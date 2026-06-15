"use client";

import { useState } from "react";
import BlockRenderer from "./BlockRenderer";
import MarkdownRenderer from "./MarkdownRenderer";
import { type AgentEvent, ToolUseCard, ToolResultCard, TextDeltaCard, formatTimestamp, AgentActivityFullscreen } from "./ProcessViewer";
import type { Block } from "@encarta/core";
import { IconLightning, IconX, IconThumbsUp, IconThumbsDown, IconRefresh, IconPencil, IconCopy, IconCheck } from "./Icons";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min === 1) return "1m ago";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return "1h ago";
  if (hr < 24) return `${hr}h ago`;
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
  streaming?: boolean;
}

function AgentEventCard({ event, onClick }: { event: AgentEvent; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg transition-colors hover:bg-[var(--border-light)]" style={{ cursor: "pointer", background: "none", border: "none", padding: "0.375rem 0.5rem", font: "inherit", color: "inherit" }}>
      <div className="flex items-center gap-1.5 text-xs mb-0.5" style={{ color: "var(--subtle)" }}>
        <span>{formatTimestamp(event.timestamp)}</span>
        <span className="font-medium uppercase text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--border-light)", color: "var(--muted)" }}>{event.type}</span>
      </div>
      {event.type === "tool_use" && <ToolUseCard data={event.data as any} />}
      {event.type === "tool_result" && <ToolResultCard data={event.data as any} />}
      {event.type === "text" && <TextDeltaCard data={event.data as any} />}
      {event.type === "status" && (
        <div className="text-xs font-medium py-1 px-2.5 border-l-2 rounded-r" style={{ borderColor: "var(--green)", background: "var(--green-subtle)", color: "var(--green)" }}>
          <IconLightning size={12} /> {String(event.data)}
        </div>
      )}
      {event.type === "error" && (
        <div className="text-xs font-medium py-1 px-2.5 border-l-2 rounded-r" style={{ borderColor: "var(--red)", background: "var(--red-subtle)", color: "var(--red)" }}>
          <IconX size={12} /> {String(event.data)}
        </div>
      )}
    </button>
  );
}

export default function ChatMessage({ role, content, blocks, createdAt, isLastAssistant, onRegenerate, onEdit, onCopy, agentEvents, streaming }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const [fullscreenEventIdx, setFullscreenEventIdx] = useState<number | undefined>(undefined);

  function handleCopy() {
    const text = content || blocks?.map(b => b.data?.text || "").filter(Boolean).join("\n") || "";
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <>
      <div className={`flex gap-4 px-6 py-5 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <div
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold"
          style={{ background: isUser ? "var(--accent-bg)" : "var(--accent)", color: isUser ? "var(--accent)" : "white" }}
        >
          {isUser ? "U" : "TS"}
        </div>

        {/* Body */}
        <div className={`w-fit max-w-[75%] space-y-1 ${isUser ? "items-end" : ""}`}>
          {content && (
            <div className={isUser ? "" : "space-y-1"}>
              {!isUser && streaming ? (
                <div className="text-base leading-relaxed streaming-cursor" style={{ color: "var(--ink)" }}>
                  {content}
                </div>
              ) : isUser ? (
                <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: "var(--accent-bg)", color: "var(--ink)" }}>
                  {content}
                </div>
              ) : (
                <div className="text-base leading-relaxed" style={{ color: "var(--ink)" }}>
                  <MarkdownRenderer content={content} />
                </div>
              )}
            </div>
          )}

          {/* Blocks (maps, timelines, images, etc.) */}
          {blocks && blocks.length > 0 && (
            <div className="mt-2">
              <BlockRenderer blocks={blocks} compact />
            </div>
          )}

          {/* Agent activity (assistant only) */}
          {!isUser && agentEvents && agentEvents.length > 0 && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border-light)" }}>
              <button
                onClick={() => setShowActivity(!showActivity)}
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                style={{ color: "var(--muted)" }}
              >
                <span className="text-[10px]">{showActivity ? "▾" : "▸"}</span>
                Agent Activity
                <span className="text-[10px] ml-0.5 px-1.5 py-0.5 rounded-full" style={{ background: "var(--border-light)", color: "var(--subtle)" }}>
                  {agentEvents.length}
                </span>
              </button>
              {showActivity && (
                <div className="mt-1.5 space-y-0.5">
                  {agentEvents.map((event, i) => (
                    <AgentEventCard key={`${event.timestamp}-${i}`} event={event} onClick={() => setFullscreenEventIdx(i)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action bar */}
          <div className={`flex items-center gap-1 pt-0.5 ${isUser ? "justify-end" : ""}`}>
            {createdAt && (
              <span className="text-xs" style={{ color: "var(--subtle)" }}>{timeAgo(createdAt)}</span>
            )}

            {!isUser && onCopy && (
              <button
                onClick={handleCopy}
                className="btn-ghost text-xs"
                style={{ color: copied ? "var(--green)" : "var(--subtle)" }}
                title="Copy"
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </button>
            )}

            {!isUser && (
              <>
                <button
                  onClick={() => setFeedback(feedback === "up" ? null : "up")}
                  className="btn-ghost text-xs"
                  style={{ color: feedback === "up" ? "var(--green)" : "var(--subtle)" }}
                  title="Helpful"
                >
                  <IconThumbsUp size={14} />
                </button>
                <button
                  onClick={() => setFeedback(feedback === "down" ? null : "down")}
                  className="btn-ghost text-xs"
                  style={{ color: feedback === "down" ? "var(--red)" : "var(--subtle)" }}
                  title="Not helpful"
                >
                  <IconThumbsDown size={14} />
                </button>
              </>
            )}

            {!isUser && isLastAssistant && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="btn-ghost text-xs"
                style={{ color: "var(--subtle)" }}
                title="Get a different response"
              >
                <IconRefresh size={14} />
              </button>
            )}

            {isUser && onEdit && (
              <button
                onClick={onEdit}
                className="btn-ghost text-xs"
                style={{ color: "var(--subtle)" }}
                title="Edit message"
              >
                <IconPencil size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen activity modal */}
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
