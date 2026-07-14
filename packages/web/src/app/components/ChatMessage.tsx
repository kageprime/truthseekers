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
  agentEvents?: any[];
  createdAt?: string;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
  streaming?: boolean;
}

function toolUseSummaryText(name: string, args: any): string {
  if (!args) return "";
  if (name === "web_search" || name === "websearch" || name === "tavilySearch" || name === "firecrawl_search") {
    return args.query ? `Searching: "${args.query}"` : "";
  }
  if (name === "get_article" || name === "create_article" || name === "get_map" || name === "suggest_related") {
    return args.slug ? `Target: "${args.slug}"` : "";
  }
  if (name === "article_search") {
    return args.query ? `Query: "${args.query}"` : "";
  }
  if (name === "generate_image") {
    return args.prompt ? `Prompt: "${args.prompt}"` : "";
  }
  if (name === "verify_citation") {
    return args.claim ? `Claim: "${args.claim}"` : "";
  }
  if (name === "task") {
    return args.objective ? `Objective: "${args.objective}"` : "";
  }
  if (name === "mem_store") {
    return args.key ? `Storing: ${args.key}` : "";
  }
  if (name === "mem_recall") {
    return args.key ? `Recalling: "${args.key}"` : "";
  }
  return "";
}

function toolResultSummaryText(data: any): string {
  const content = data.result ?? data.content ?? "";
  if (!content) return "";
  if (typeof content === "string" && (content.startsWith("[") || content.startsWith("{"))) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return `Found ${parsed.length} results`;
      }
      if (parsed.blockCount !== undefined) {
        return `Rendered ${parsed.blockCount} blocks`;
      }
      if (parsed.queued) {
        return `Queued: ${parsed.slug}`;
      }
    } catch {}
  }
  const str = typeof content === "string" ? content : JSON.stringify(content);
  return str.length > 120 ? str.slice(0, 120) + "..." : str;
}

import { toolLabel } from "./ProcessViewer";

function ThinkingBox({ events, streaming }: { events: any[]; streaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const activeEvents = events.filter(e => 
    e.type === "tool_use" || 
    e.type === "tool_result" || 
    e.type === "status" || 
    e.type === "error"
  );

  if (activeEvents.length === 0) return null;

  const toolCallCount = activeEvents.filter(e => e.type === "tool_use").length;

  return (
    <div className="my-2 text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 font-medium py-1 px-2 rounded-md hover:bg-accent-bg/10 transition-colors text-subtle border border-border/20 bg-surface-elevated/40"
      >
        <span className={`inline-block transition-transform duration-200 text-[8px] ${isOpen ? "rotate-90" : ""}`}>
          ▶
        </span>
        <span className="flex items-center gap-1.5">
          <span>🧠 Thought process</span>
          {toolCallCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-border/20 font-mono">
              {toolCallCount} step{toolCallCount !== 1 ? "s" : ""}
            </span>
          )}
          {streaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 pl-3 ml-2.5 border-l border-border/30 space-y-2.5 max-w-2xl py-0.5">
          {activeEvents.map((event, idx) => {
            const isError = event.type === "error";
            const isStatus = event.type === "status";
            const isUse = event.type === "tool_use";
            const isResult = event.type === "tool_result";

            let label = "";
            let summary = "";

            if (isUse) {
              const name = event.data?.name || "";
              label = toolLabel(name);
              const args = event.data?.args || {};
              summary = toolUseSummaryText(name, args);
            } else if (isResult) {
              const name = event.data?.name || "";
              label = `Returned: ${toolLabel(name).replace(/^[^\s]+\s+/, "")}`;
              summary = toolResultSummaryText(event.data);
            } else if (isStatus) {
              label = `⚡ Status`;
              summary = String(event.data || "");
            } else if (isError) {
              label = `🛑 Error`;
              summary = String(event.data || "");
            }

            return (
              <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-border/10 pl-2">
                <div className="flex items-center gap-2 font-medium text-ink-secondary">
                  <span>{label}</span>
                </div>
                {summary && (
                  <div className="text-[10px] text-subtle/80 pl-0.5 font-mono break-all max-w-lg leading-relaxed">
                    {summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ChatMessage = memo(function ChatMessage({
  role,
  content,
  blocks,
  agentEvents,
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

          {/* Thinking Box */}
          {agentEvents && agentEvents.length > 0 && (
            <ThinkingBox events={agentEvents} streaming={streaming} />
          )}

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
