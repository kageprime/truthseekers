"use client";

import { useState } from "react";
import BlockRenderer from "./BlockRenderer";
import MarkdownRenderer from "./MarkdownRenderer";
import type { Block } from "@encarta/core";
import { IconThumbsUp, IconThumbsDown, IconRefresh, IconPencil, IconCopy, IconCheck } from "./Icons";

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
  streaming?: boolean;
}

export default function ChatMessage({ role, content, blocks, createdAt, isLastAssistant, onRegenerate, onEdit, onCopy, streaming }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  function handleCopy() {
    const text = content || blocks?.map(b => b.data?.text || "").filter(Boolean).join("\n") || "";
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <>
      <div className={`flex gap-4 px-6 py-5 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Assistant avatar only */}
        {!isUser && (
          <img src="/logo-icon.png" alt="TS" className="shrink-0 w-9 h-9 rounded-full" style={{ objectFit: "contain" }} />
        )}

        {/* Body */}
        <div className={`space-y-1 ${isUser ? "w-fit max-w-[75%] items-end" : "flex-1 min-w-0"}`}>
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
    </>
  );
}
