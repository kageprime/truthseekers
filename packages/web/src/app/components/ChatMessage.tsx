"use client";

import { memo, useState } from "react";
import BlockRenderer from "./BlockRenderer";
import MarkdownRenderer from "./MarkdownRenderer";
import type { Block } from "@encarta/core";
import { sanitizeMessage } from "@/lib/dsml";
import { IconThumbsUp, IconThumbsDown, IconRefresh, IconCopy, IconCheck } from "./Icons";

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
  streaming?: boolean;
}

const ChatMessage = memo(function ChatMessage({
  role,
  content,
  blocks,
  createdAt,
  isLastAssistant,
  onRegenerate,
  streaming,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Strip any inline DSML/render_blocks markup the model emitted as raw text
  // and merge its blocks with any the backend already attached. This is the
  // last line of defense — the backend also extracts these, but stored
  // messages and live tokens can still carry the raw markup.
  const { content: cleanContent, blocks: mergedBlocks } = sanitizeMessage(content ?? "", blocks);

  function handleCopy() {
    const text = cleanContent || mergedBlocks?.map((b) => b.data?.text || "").filter(Boolean).join("\n") || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isUser) {
    return (
      <div className="flex justify-end px-3 sm:px-6 py-3 group">
        <div className="max-w-[70%] flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-subtle">You</span>
            {createdAt && <span className="text-[9px] text-subtle">{timeAgo(createdAt)}</span>}
          </div>
          <div className="px-3.5 py-2.5 rounded-xl text-sm bg-accent-bg border border-accent/15 text-ink leading-relaxed">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-3 sm:px-6 py-4 group transition-colors ${streaming ? "" : "hover:bg-accent-bg/[0.04]"}`}>
      <div className="space-y-1">
          {/* Label */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Truthseeker
            </span>
            {createdAt && <span className="text-[9px] text-subtle">{timeAgo(createdAt)}</span>}
          </div>

          {/* Content */}
          {cleanContent ? (
            <div className={`text-[15px] leading-relaxed text-ink-secondary font-serif-body ${streaming ? "streaming-cursor" : ""}`}>
              <MarkdownRenderer content={cleanContent} />
            </div>
          ) : streaming ? (
            <div className="flex items-center gap-1.5 py-2">
              <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : null}

          {/* Blocks */}
          {mergedBlocks && mergedBlocks.length > 0 && (
            <div className="mt-2">
              <BlockRenderer blocks={mergedBlocks} compact />
            </div>
          )}

          {/* Action bar */}
          {!streaming && (
            <div className={`flex items-center gap-1 pt-1 transition-opacity ${
              isLastAssistant ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}>
              <button onClick={handleCopy} className="btn-ghost text-xs" style={{ color: copied ? "var(--forest)" : "var(--subtle)" }} title="Copy">
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </button>
              <button onClick={() => setFeedback(feedback === "up" ? null : "up")} className="btn-ghost text-xs" style={{ color: feedback === "up" ? "var(--forest)" : "var(--subtle)" }} title="Helpful">
                <IconThumbsUp size={12} />
              </button>
              <button onClick={() => setFeedback(feedback === "down" ? null : "down")} className="btn-ghost text-xs" style={{ color: feedback === "down" ? "var(--oxblood)" : "var(--subtle)" }} title="Not helpful">
                <IconThumbsDown size={12} />
              </button>
              {isLastAssistant && onRegenerate && (
                <button onClick={onRegenerate} className="btn-ghost text-xs text-subtle" title="Regenerate">
                  <IconRefresh size={12} />
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
});

export default ChatMessage;
