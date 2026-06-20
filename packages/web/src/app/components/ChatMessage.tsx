"use client";

import { useState } from "react";
import BlockRenderer from "./BlockRenderer";
import ArticleBlock from "./ArticleBlock";
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
    <div className={`flex gap-3 px-6 py-4 group ${isUser ? "flex-row-reverse" : ""} transition-colors ${streaming ? "bg-[var(--accent-bg)]/5" : "hover:bg-black/[0.02]"}`}>
      {/* Body */}
      <div className={`space-y-1 min-w-0 ${isUser ? "items-end" : "flex-1"}`}>
        {/* Label */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--subtle)" }}>
            {isUser ? "You" : "Truthseeker"}
          </span>
          {createdAt && (
            <span className="text-[10px]" style={{ color: "var(--subtle)" }}>{timeAgo(createdAt)}</span>
          )}
          {streaming && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--accent)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Generating...
            </span>
          )}
        </div>

        {/* Content */}
        {isUser ? (
          <div className="px-4 py-2.5 rounded-2xl text-sm w-fit max-w-[75%]" style={{ background: "var(--accent-bg)", color: "var(--ink)" }}>
            {content}
          </div>
        ) : (
          <>
            {content ? (
              <div className={`text-base leading-relaxed ${streaming ? "streaming-cursor" : ""}`} style={{ color: "var(--ink)" }}>
                <MarkdownRenderer content={content} />
              </div>
            ) : streaming ? (
              <div className="flex items-center gap-1.5 py-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : null}
          </>
        )}

        {/* Blocks (maps, timelines, images, etc.) */}
        {blocks && blocks.length > 0 && (
          <div className="mt-2">
            {blocks.length > 4 ? (
              <ArticleBlock blocks={blocks} />
            ) : (
              <BlockRenderer blocks={blocks} compact />
            )}
          </div>
        )}

        {/* Action bar */}
        <div className={`flex items-center gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "justify-end" : ""}`}>
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
  );
}
