"use client";

import { useArticleView, type ViewMode } from "../ArticleViewContext";

const modes: { key: ViewMode; label: string }[] = [
  { key: "stream", label: "Stream" },
  { key: "explore", label: "Explore" },
  { key: "press", label: "Press" },
];

export default function ViewSwitcher() {
  const { mode, setMode, article } = useArticleView();
  if (!article) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-full p-0.5 bg-ink/10">
      {modes.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className="px-2.5 py-1 text-[10px] font-medium rounded-full transition-all"
            style={{
              background: active ? "var(--gold)" : "transparent",
              color: active ? "white" : "var(--ink-secondary)",
              opacity: active ? 1 : 0.6,
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}