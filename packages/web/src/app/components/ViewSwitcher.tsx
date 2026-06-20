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
    <div className="flex items-center gap-0.5 bg-white/10 rounded-full p-0.5">
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-all ${
            mode === m.key ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
