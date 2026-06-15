"use client";

import { useEffect } from "react";
import type { FC, SVGProps } from "react";
import { IconPencil } from "./Icons";

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: FC<SVGProps<SVGSVGElement> & { size?: number }>;
}

interface ChatInputProps {
  input: string;
  sending: boolean;
  editingIndex: number | null;
  showCommands: boolean;
  slashCommands: SlashCommand[];
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onCancelEdit: () => void;
  onSlashCommand: (cmd: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  suggestions?: string[];
}

export default function ChatInput({
  input, sending, editingIndex, showCommands, slashCommands,
  onChange, onSend, onStop, onCancelEdit, onSlashCommand, onKeyDown, textareaRef, suggestions = [],
}: ChatInputProps) {

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input, textareaRef]);

  const hasInput = input.trim().length > 0;

  return (
    <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: "linear-gradient(transparent, var(--surface) 40%)" }}>
      <div className="max-w-3xl mx-auto">
        {editingIndex !== null && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <IconPencil size={14} /> <span style={{ color: "var(--accent)" }}>Editing message</span>
            <button onClick={onCancelEdit} className="btn-ghost text-xs" style={{ color: "var(--subtle)" }}>Cancel</button>
          </div>
        )}

        {/* Suggestion chips */}
        {!hasInput && !sending && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => { onChange(s); onSend(); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface-elevated)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Slash commands dropdown */}
        {showCommands && (
          <div className="mb-2 rounded-xl glass-sm overflow-hidden">
            {slashCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => onSlashCommand(`/${cmd.id}`)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--border-light)] transition-colors"
                style={{ color: "var(--ink)" }}
              >
                <cmd.icon size={16} />
                <div>
                  <span className="font-medium">{cmd.label}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--subtle)" }}>{cmd.description}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="glass-sm rounded-2xl flex items-end gap-2 p-1.5" style={{ background: "var(--glass)", backdropFilter: "blur(24px)" }}>
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={sending ? "Waiting for response..." : "Ask about any topic..."}
              disabled={sending}
              rows={1}
              className="w-full resize-none bg-transparent border-none outline-none px-3 py-2.5 text-sm"
              style={{ minHeight: "40px", maxHeight: "200px", color: "var(--ink)" }}
            />
          </div>
          {sending ? (
            <button onClick={onStop} aria-label="Stop generating" className="btn btn-sm shrink-0" style={{ background: "var(--red)", color: "white" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!hasInput && editingIndex === null}
              aria-label={editingIndex !== null ? "Update message" : "Send message"}
              className="btn-icon shrink-0"
              style={{
                background: hasInput ? "var(--accent)" : "var(--border)",
                color: hasInput ? "white" : "var(--subtle)",
                borderRadius: "10px",
                transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
