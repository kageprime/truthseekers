"use client";

import { useEffect, useState, useRef } from "react";
import type { FC, SVGProps } from "react";
import { IconPencil, IconChevronRight } from "./Icons";

const MODELS = [
  { id: "gemma-4-31B-it", label: "Gemma 4 31B" },
  { id: "deepseek-4-flash", label: "DeepSeek Flash" },
  { id: "deepseek-v4-pro", label: "DeepSeek Pro" },
];

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
  model?: string;
  onModelChange?: (model: string) => void;

}

export default function ChatInput({
  input, sending, editingIndex, showCommands, slashCommands,
  onChange, onSend, onStop, onCancelEdit, onSlashCommand, onKeyDown, textareaRef, suggestions = [],
  model, onModelChange,
}: ChatInputProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input, textareaRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    if (modelOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelOpen]);

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

        {/* Model selector */}
        {model && onModelChange && (
          <div className="flex items-center gap-2 mb-2" style={{ minHeight: 28 }}>
            <div className="relative" ref={modelRef}>
              <button
                onClick={() => setModelOpen(!modelOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors"
                style={{ background: "var(--border-light)", color: "var(--muted)" }}
              >
                {MODELS.find((m) => m.id === model)?.label || model}
                <IconChevronRight size={10} className={`transition-transform ${modelOpen ? "rotate-90" : ""}`} />
              </button>
              {modelOpen && (
                <div
                  className="absolute bottom-full left-0 mb-1 rounded-xl p-1 shadow-lg glass-sm"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-light)", zIndex: 60, minWidth: "150px" }}
                >
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { onModelChange(m.id); setModelOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors"
                      style={{
                        background: m.id === model ? "var(--accent-bg)" : "transparent",
                        color: m.id === model ? "var(--accent)" : "var(--ink)",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.id === model ? "var(--accent)" : "var(--border)" }} />
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
