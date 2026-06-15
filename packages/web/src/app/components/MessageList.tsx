"use client";

import ChatMessage from "./ChatMessage";
import FollowUpSuggestions from "./FollowUpSuggestions";
import type { AgentEvent } from "./ProcessViewer";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  blocks?: any[];
  agentEvents?: AgentEvent[];
  createdAt?: string;
}

interface MessageListProps {
  messages: Message[];
  streamContent: string;
  streamBlocks: any[];
  sending: boolean;
  error: string | null;
  followUps: string[];
  showScrollBtn: boolean;
  phaseLabel: string;
  agentEvents: AgentEvent[];
  lastAssistantIndex: number;
  suggestedTopics: string[];
  onScrollToBottom: () => void;
  onRegenerate: () => void;
  onEdit: (index: number) => void;
  onCopy: (content: string) => void;
  onSend: (msg: string) => void;
  onRetry: () => void;
  onSetInput: (val: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function MessageList({
  messages, streamContent, streamBlocks, sending, error, followUps,
  showScrollBtn, phaseLabel, agentEvents, lastAssistantIndex,
  suggestedTopics, onScrollToBottom, onRegenerate, onEdit, onCopy,
  onSend, onRetry, onSetInput, scrollRef,
}: MessageListProps) {
  return (
    <div ref={scrollRef} role="log" aria-label="Chat messages" className="flex-1 overflow-y-auto min-h-0 relative">
      {showScrollBtn && (
        <button
          onClick={onScrollToBottom}
          aria-label="Scroll to bottom"
          className="sticky bottom-4 z-10 mx-auto flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full shadow-lg border transition-opacity hover:opacity-80"
          style={{ background: "white", borderColor: "var(--border)", color: "var(--ink)" }}
        >
          ↓ Scroll to bottom
        </button>
      )}

      {messages.length === 0 && !sending && !error ? (
        <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>Truthseekers</h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Ask anything — I'll research and build rich, interactive responses</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {suggestedTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => onSetInput(topic)}
                className="px-4 py-2 text-sm rounded-full border transition-colors hover:bg-[#fef3c7]"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              blocks={msg.blocks}
              createdAt={msg.createdAt}
              isLastAssistant={i === lastAssistantIndex}
              agentEvents={msg.agentEvents}
              onEdit={() => onEdit(i)}
              onRegenerate={onRegenerate}
              onCopy={() => onCopy(msg.content)}
            />
          ))}
          {followUps.length > 0 && !sending && (
            <FollowUpSuggestions followUps={followUps} onClick={onSend} />
          )}
          {error && (
            <div className="mx-6 my-4 p-4 rounded-xl border" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">❌</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#991b1b" }}>Something went wrong</p>
                  <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{error}</p>
                  <button onClick={onRetry} className="mt-3 btn-primary btn-sm">Try Again</button>
                </div>
              </div>
            </div>
          )}
          {streamContent && (
            <div aria-live="polite" aria-atomic="true">
              <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} agentEvents={agentEvents} />
            </div>
          )}
          {sending && (
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--subtle)" }}>
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--orange)] animate-pulse" />
                <span className="text-xs pixel" style={{ color: "var(--muted)" }}>{phaseLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
