"use client";

import ChatMessage from "./ChatMessage";
import FollowUpSuggestions from "./FollowUpSuggestions";
import { type AgentEvent, ToolUseCard, ToolResultCard, TextDeltaCard } from "./ProcessViewer";
import { IconXCircle, IconLightning, IconX } from "./Icons";

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

function InlineAgentEvent({ event }: { event: AgentEvent }) {
  return (
    <div className="flex items-start gap-1.5 py-1 px-2 rounded-lg">
      <div className="shrink-0 flex items-center gap-1 text-xs" style={{ color: "var(--muted)", fontFamily: "monospace", minWidth: "3.5rem" }}>
        {event.type === "tool_use" && <span style={{ color: "var(--accent)" }}>◆</span>}
        {event.type === "tool_result" && <span style={{ color: "var(--green)" }}>◀</span>}
        {event.type === "text" && <span style={{ color: "var(--ink)" }}>▸</span>}
        {event.type === "status" && <IconLightning size={10} />}
        {event.type === "error" && <IconX size={10} />}
      </div>
      <div className="flex-1 min-w-0">
        {event.type === "tool_use" && (
          <ToolUseCard data={event.data as any} />
        )}
        {event.type === "tool_result" && (
          <ToolResultCard data={event.data as any} />
        )}
        {event.type === "text" && (
          <TextDeltaCard data={event.data as any} />
        )}
        {event.type === "status" && (
          <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            {String(event.data)}
          </div>
        )}
        {event.type === "error" && (
          <div className="text-xs font-medium" style={{ color: "var(--red)" }}>
            {String(event.data)}
          </div>
        )}
      </div>
    </div>
  );
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
        <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold mb-4" style={{ background: "var(--accent)", color: "white" }}>
            TS
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--ink)" }}>Truthseekers</h2>
          <p className="text-sm mb-8 max-w-md" style={{ color: "var(--muted)" }}>Ask anything — I'll research and build rich, interactive responses with maps, timelines, diagrams, and more.</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {suggestedTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => onSetInput(topic)}
                className="px-4 py-2 text-sm rounded-full border transition-colors hover:bg-[var(--accent-bg)] hover:border-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
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
          {error && (
            <div className="mx-6 my-4 p-4 rounded-xl border" style={{ background: "var(--red-subtle)", borderColor: "var(--red)" }}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5"><IconXCircle size={20} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>Something went wrong</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{error}</p>
                  <button onClick={onRetry} className="btn btn-sm mt-3" style={{ background: "var(--accent)", color: "white" }}>Try Again</button>
                </div>
              </div>
            </div>
          )}

          {/* Streaming section — visible throughout the entire send */}
          {sending && (
            <div className="px-6 py-3 animate-fade-in">
              {/* Phase label — shown until blocks/content arrive */}
              {!streamContent && streamBlocks.length === 0 && (
                <div className="flex items-center gap-3 text-sm mb-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{phaseLabel}</span>
                </div>
              )}

              {/* Live agent activity — always visible during streaming */}
              {agentEvents.length > 0 && (
                <div className="glass-sm rounded-xl py-2 px-1 space-y-0.5" style={{ background: "var(--surface-glass)" }}>
                  <div className="text-xs font-semibold px-2 pb-1" style={{ color: "var(--muted)" }}>
                    Agent Activity · {agentEvents.length}
                  </div>
                  {agentEvents.map((event, i) => (
                    <InlineAgentEvent key={`${event.timestamp}-${i}`} event={event} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Streaming preview — rendered blocks/content appear below agent activity */}
          {(streamContent || streamBlocks.length > 0) && (
            <div aria-live="polite" aria-atomic="true" className="px-6">
              <ChatMessage role="assistant" content={streamContent || ""} blocks={streamBlocks} agentEvents={[]} streaming />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
