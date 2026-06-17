"use client";

import ChatMessage from "./ChatMessage";
import FollowUpSuggestions from "./FollowUpSuggestions";
import EmptyChatState from "./EmptyChatState";
import ErrorBanner from "./ErrorBanner";
import StreamingPreview from "./StreamingPreview";
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
          className="sticky bottom-4 z-10 mx-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full glass-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--ink)" }}
        >
          ↓ Scroll to bottom
        </button>
      )}

      {messages.length === 0 && !sending && !error ? (
        <EmptyChatState suggestedTopics={suggestedTopics} onSetInput={onSetInput} />
      ) : (
        <div className="max-w-3xl mx-auto">
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
            <div className="px-6 py-2">
              <FollowUpSuggestions followUps={followUps} onClick={onSend} />
            </div>
          )}
          {error && <ErrorBanner error={error} onRetry={onRetry} />}
          <StreamingPreview
            sending={sending}
            streamContent={streamContent}
            streamBlocks={streamBlocks}
            agentEvents={agentEvents}
            phaseLabel={phaseLabel}
          />
        </div>
      )}
    </div>
  );
}
