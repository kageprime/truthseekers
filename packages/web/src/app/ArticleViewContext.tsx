"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Block } from "@encarta/core";

export type ViewMode = "stream" | "explore" | "press" | "graph";

interface ArticleViewValue {
  article: { slug: string | null; title: string; blocks: Block[] } | null;
  mode: ViewMode;
  open: (title: string, blocks: Block[], initialMode?: ViewMode, slug?: string | null) => void;
  close: () => void;
  setMode: (mode: ViewMode) => void;
}

const ArticleViewContext = createContext<ArticleViewValue | null>(null);

export function ArticleViewProvider({ children }: { children: ReactNode }) {
  const [article, setArticle] = useState<{ slug: string | null; title: string; blocks: Block[] } | null>(null);
  const [mode, setMode] = useState<ViewMode>("explore");

  const open = useCallback((title: string, blocks: Block[], initialMode: ViewMode = "explore", slug: string | null = null) => {
    setArticle({ slug, title, blocks });
    setMode(initialMode);
  }, []);

  const close = useCallback(() => {
    setArticle(null);
  }, []);

  return (
    <ArticleViewContext.Provider value={{ article, mode, open, close, setMode }}>
      {children}
    </ArticleViewContext.Provider>
  );
}

export function useArticleView(): ArticleViewValue {
  const ctx = useContext(ArticleViewContext);
  if (!ctx) throw new Error("useArticleView must be used within ArticleViewProvider");
  return ctx;
}
