"use client";

import { useEffect } from "react";

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
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
}

export default function ChatInput({
  input, sending, editingIndex, showCommands, slashCommands,
  onChange, onSend, onStop, onCancelEdit, onSlashCommand, onKeyDown, textareaRef,
}: ChatInputProps) {

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input, textareaRef]);

  return (
    <div className="shrink-0 sticky bottom-0 px-4 py-3">
      <div className="max-w-4xl mx-auto">
        {editingIndex !== null && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span style={{ color: "var(--orange)" }}>✏️ Editing message</span>
            <button onClick={onCancelEdit} className="text-[10px] font-medium" style={{ color: "#9aa0a6" }}>Cancel</button>
          </div>
        )}
        {showCommands && (
          <div
            className="mb-2 rounded-xl border shadow-lg overflow-hidden"
            style={{ background: "white", borderColor: "#e5e5e5" }}
          >
            {slashCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => onSlashCommand(`/${cmd.id}`)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f5f5f4] transition-colors"
                style={{ color: "var(--ink)" }}
              >
                <span>{cmd.icon}</span>
                <div>
                  <span className="font-medium">{cmd.label}</span>
                  <span className="text-[11px] ml-2" style={{ color: "#9aa0a6" }}>{cmd.description}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about any topic..."
              disabled={sending}
              rows={1}
              className="w-full pixel-input resize-none"
              style={{ minHeight: "44px", maxHeight: "200px" }}
            />
          </div>
          {sending ? (
            <button onClick={onStop} aria-label="Stop generating" className="btn-primary shrink-0" data-color="red" style={{ minHeight: "44px" }}>
              Stop
            </button>
          ) : (
            <button onClick={onSend} disabled={!input.trim() && editingIndex === null} aria-label={editingIndex !== null ? "Update message" : "Send message"} className="btn-primary shrink-0" style={{ minHeight: "44px" }}>
              {editingIndex !== null ? "Update" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
