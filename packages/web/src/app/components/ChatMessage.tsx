"use client";

import { memo, useState } from "react";
import BlockRenderer from "./BlockRenderer";
import RetroMarkdown from "./retro/RetroMarkdown";
import type { Block } from "@encarta/core";
import { sanitizeMessage } from "@/lib/dsml";
import { IconThumbsUp, IconThumbsDown, IconRefresh, IconCopy, IconCheck } from "./Icons";
import { toolLabel } from "./ProcessViewer";

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
        className="flex items-center gap-1.5 py-0.5 px-0 rounded-[var(--r-radius)] transition-colors bg-transparent border-0 cursor-pointer text-[var(--r-muted)] hover:text-[var(--r-ink)]"
      >
        <span className={`inline-block transition-transform duration-200 text-[8px] ${isOpen ? "rotate-90" : ""}`}>
          ▶
        </span>
        <span className="flex items-center gap-1.5">
          <span>Thought process</span>
          {toolCallCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--r-nav-bg)] font-mono text-[var(--r-ink-secondary)]">
              {toolCallCount} step{toolCallCount !== 1 ? "s" : ""}
            </span>
          )}
          {streaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--r-accent)] animate-pulse" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 pl-3 ml-2.5 border-l border-[var(--r-border)] space-y-2 max-w-2xl py-0.5">
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
              label = `Status`;
              summary = String(event.data || "");
            } else if (isError) {
              label = `Error`;
              summary = String(event.data || "");
            }

            return (
              <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-[var(--r-border)] pl-2">
                <div className="flex items-center gap-2 font-medium text-[var(--r-ink-secondary)]">
                  <span>{label}</span>
                </div>
                {summary && (
                  <div className="text-[10px] text-[var(--r-muted)] pl-0.5 font-mono break-all leading-relaxed">
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
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--r-muted)]">You</span>
            {createdAt && <span className="text-[9px] text-[var(--r-muted)]">{timeAgo(createdAt)}</span>}
          </div>
          <div className="px-3.5 py-2.5 text-[13.5px] text-white leading-relaxed border bg-[var(--r-accent)] rounded-[var(--r-radius)] shadow-sm" style={{ borderColor: "var(--r-accent)" }}>
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-3 sm:px-6 py-4 group transition-colors ${streaming ? "" : "hover:bg-black/5"}`}>
      <div className="space-y-1.5 max-w-[100%]">
        {/* Label */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--r-accent)]">
            Truthseeker Agent
          </span>
          {createdAt && <span className="text-[9px] text-[var(--r-muted)]">{timeAgo(createdAt)}</span>}
        </div>

        {/* Thinking Box */}
        {agentEvents && agentEvents.length > 0 && (
          <ThinkingBox events={agentEvents} streaming={streaming} />
        )}

        {/* Content */}
        {cleanContent ? (
          <div
            className={`text-[14px] leading-[1.7] text-[var(--r-ink)] bg-[var(--r-surface-elevated)] border p-3.5 sm:p-4 rounded-[var(--r-radius)] shadow-sm ${streaming ? "streaming-cursor" : ""}`}
            style={{ borderColor: "var(--r-border)", fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <RetroMarkdown content={cleanContent} />
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-1.5 py-2">
            <span className="w-2 h-2 rounded-full bg-[var(--r-accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-[var(--r-accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-[var(--r-accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : null}

        {/* Blocks */}
        {mergedBlocks && mergedBlocks.length > 0 && (
          <div className="mt-2.5">
            <BlockRenderer blocks={mergedBlocks} compact />
          </div>
        )}

        {/* Action bar — collapsed behind ⋯, content-first */}
        {!streaming && (
          <div className={`flex items-center gap-1 pt-1 transition-opacity ${
            menuOpen || isLastAssistant ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Message actions"
              className="px-1.5 py-0.5 text-[13px] font-bold tracking-widest text-[var(--r-muted)] hover:text-[var(--r-ink)] transition-colors bg-transparent border-0 cursor-pointer"
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <button onClick={handleCopy} className="p-1 text-[11px] text-[var(--r-muted)] hover:text-[var(--r-ink)] transition-colors bg-transparent border-0 cursor-pointer" title="Copy">
                  {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                </button>
                <button onClick={() => setFeedback(feedback === "up" ? null : "up")} className={`p-1 text-[11px] transition-colors bg-transparent border-0 cursor-pointer ${feedback === "up" ? "text-emerald-700 font-bold" : "text-[var(--r-muted)] hover:text-[var(--r-ink)]"}`} title="Helpful">
                  <IconThumbsUp size={13} />
                </button>
                <button onClick={() => setFeedback(feedback === "down" ? null : "down")} className={`p-1 text-[11px] transition-colors bg-transparent border-0 cursor-pointer ${feedback === "down" ? "text-red-700 font-bold" : "text-[var(--r-muted)] hover:text-[var(--r-ink)]"}`} title="Not helpful">
                  <IconThumbsDown size={13} />
                </button>
                {isLastAssistant && onRegenerate && (
                  <button onClick={onRegenerate} className="p-1 text-[11px] text-[var(--r-muted)] hover:text-[var(--r-ink)] transition-colors bg-transparent border-0 cursor-pointer" title="Regenerate">
                    <IconRefresh size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
