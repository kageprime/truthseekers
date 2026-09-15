"use client";

import { useArticleView } from "../ArticleViewContext";
import { useIntersectionToc } from "./useIntersectionToc";

export function useVisibleContent() {
  const { article } = useArticleView();
  const visibleSections = useIntersectionToc();

  return {
    articleSlug: article?.slug ?? null,
    articleTitle: article?.title ?? null,
    visibleSections,
    hasContent: Boolean(article),
  };
}
