"use client";

import ChatMessage from "./ChatMessage";

interface StreamingPreviewProps {
  sending: boolean;
  streamContent: string;
  streamBlocks: any[];
  phaseLabel: string;
}

export default function StreamingPreview({ sending, streamContent, streamBlocks, phaseLabel }: StreamingPreviewProps) {
  if (!sending) return null;

  return (
    <div className="px-6 py-3 animate-fade-in">
      {!streamContent && streamBlocks.length === 0 && (
        <div className="flex items-center gap-3 text-sm mb-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{phaseLabel}</span>
        </div>
      )}

      {(streamContent || streamBlocks.length > 0) && (
        <div aria-live="polite" aria-atomic="true">
          <ChatMessage role="assistant" content={streamContent || ""} blocks={streamBlocks} streaming />
        </div>
      )}
    </div>
  );
}
