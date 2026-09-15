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
  
  // Find the latest active step for the live header preview
  const lastEvent = activeEvents[activeEvents.length - 1];
  let livePreview = "";
  if (lastEvent) {
    if (lastEvent.type === "tool_use") {
      const name = lastEvent.data?.name || "";
      livePreview = toolUseSummaryText(name, lastEvent.data?.args) || toolLabel(name);
    } else if (lastEvent.type === "tool_result") {
      livePreview = `Completed ${toolLabel(lastEvent.data?.name || "").replace(/^[^\s]+\s+/, "")}`;
    } else if (lastEvent.type === "status") {
      livePreview = String(lastEvent.data || "");
    }
  }

  return (
    <div className="my-2.5 text-xs select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 py-1.5 px-3 rounded-xl transition-all border cursor-pointer text-[var(--r-ink)] bg-[var(--r-nav-bg)]/80 hover:bg-[var(--r-nav-bg)] border-[var(--r-border)]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-transform duration-200 text-[9px] ${isOpen ? "rotate-90" : ""}`}>
            ▶
          </span>
          <span className="font-semibold text-[11px] sm:text-[12px] text-[var(--r-accent)] flex items-center gap-1.5 shrink-0">
            <span>Agent Thoughts</span>
            {toolCallCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--r-surface-elevated)] border border-[var(--r-border)] font-mono text-[var(--r-ink-secondary)]">
                {toolCallCount} {toolCallCount === 1 ? "step" : "steps"}
              </span>
            )}
          </span>
          {streaming && livePreview && (
            <span className="text-[11px] text-[var(--r-muted)] truncate max-w-[160px] sm:max-w-[280px]">
              · {livePreview}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {streaming && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--r-accent)] font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--r-accent)] animate-pulse" />
              <span>Working</span>
            </span>
          )}
          {!streaming && (
            <span className="text-[10px] text-[var(--r-muted)] font-mono">
              {isOpen ? "Hide" : "Show"}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="mt-2 pl-3 pr-2 py-2.5 rounded-xl border border-[var(--r-border)] bg-[var(--r-nav-bg)]/40 space-y-2.5 max-w-2xl">
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
              label = `Result: ${toolLabel(name).replace(/^[^\s]+\s+/, "")}`;
              summary = toolResultSummaryText(event.data);
            } else if (isStatus) {
              label = `Status`;
              summary = String(event.data || "");
            } else if (isError) {
              label = `Error`;
              summary = String(event.data || "");
            }

            return (
              <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-[var(--r-accent)]/60 pl-2.5 py-0.5">
                <div className="flex items-center gap-2 font-medium text-[11px] text-[var(--r-ink)]">
                  <span>{label}</span>
                </div>
                {summary && (
                  <div className="text-[10.5px] text-[var(--r-muted)] font-mono break-all leading-relaxed bg-[var(--r-surface)]/60 px-2 py-1 rounded-md mt-0.5 border border-[var(--r-border)]/50">
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
      <div className="flex justify-end px-3 sm:px-6 py-2.5 group">
        <div className="max-w-[88%] sm:max-w-[75%] flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--r-muted)]">You</span>
            {createdAt && <span className="text-[9px] text-[var(--r-muted)]">{timeAgo(createdAt)}</span>}
          </div>
          <div className="px-4 py-2.5 text-[14px] text-white leading-relaxed bg-[var(--r-accent)] rounded-2xl rounded-tr-xs shadow-sm border border-[var(--r-accent)]">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-2.5 sm:px-6 py-3 group transition-colors ${streaming ? "" : "hover:bg-black/5"}`}>
      <div className="space-y-1.5 max-w-[100%]">
        {/* Label */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--r-accent)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--r-accent)]" />
            <span>Truthseeker Agent</span>
          </span>
          {createdAt && <span className="text-[9px] text-[var(--r-muted)]">{timeAgo(createdAt)}</span>}
        </div>

        {/* Thinking Box (Agent Thoughts) */}
        {agentEvents && agentEvents.length > 0 && (
          <ThinkingBox events={agentEvents} streaming={streaming} />
        )}

        {/* Content */}
        {cleanContent ? (
          <div
            className={`text-[14.5px] leading-[1.75] text-[var(--r-ink)] bg-[var(--r-surface-elevated)] border p-3.5 sm:p-4 rounded-2xl rounded-tl-xs shadow-sm ${streaming ? "streaming-cursor" : ""}`}
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
