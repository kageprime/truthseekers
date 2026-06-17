"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as api from "@/lib/api";

// ─── Query helper ───────────────────────────────────────────────────────

function useApiQuery<T>(key: string, fetcher: () => Promise<T>, options?: { enabled?: boolean }) {
  const result = useQuery<T, Error>({ queryKey: [key], queryFn: fetcher, enabled: options?.enabled ?? true });
  return { data: result.data, loading: result.isLoading || result.isFetching, error: result.error?.message ?? null, refetch: result.refetch };
}

// ─── Mutation helper ────────────────────────────────────────────────────

function useApiMutation<TResult, TArgs extends any[] = []>(mutator: (...args: TArgs) => Promise<TResult>) {
  const mutation = useMutation<TResult, Error, TArgs>({ mutationFn: (args: TArgs) => mutator(...args) });
  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    try { return await mutation.mutateAsync(args); } catch { return undefined; }
  }, [mutation.mutateAsync]);
  return { data: mutation.data, loading: mutation.isPending, error: mutation.error?.message ?? null, mutate, setData: () => {}, reset: mutation.reset };
}

// ─── Articles ───────────────────────────────────────────────────────────

export function useArticles(offset = 0, limit = 50) {
  return useApiQuery(`articles-${offset}-${limit}`, () => api.fetchArticles(offset, limit));
}

export function useArticleSearch(query: string) {
  return useApiQuery(`article-search-${query}`, () => api.searchArticles(query), { enabled: query.length > 0 });
}

export function useArticle(slug: string | undefined) {
  return useApiQuery(`article-${slug}`, () => api.fetchArticle(slug!), { enabled: !!slug });
}

export function useArticleStatus(slug: string | undefined) {
  return useApiQuery(`article-status-${slug}`, () => api.fetchArticleStatus(slug!), { enabled: !!slug });
}

export function useQuota() {
  return useApiQuery("quota", () => api.fetchQuota());
}

export function useGenerateArticle() {
  return useApiMutation(({ slug, persona }: { slug: string; persona?: string }) => api.generateArticle(slug, persona));
}

export function useRefreshArticle() {
  return useApiMutation((slug: string) => api.refreshArticle(slug));
}

// ─── Maps ───────────────────────────────────────────────────────────────

export function useMaps(limit = 50, offset = 0) {
  return useApiQuery(`maps-${limit}-${offset}`, () => api.fetchMaps(limit, offset));
}

export function useMapSearch(query: string) {
  return useApiQuery(`map-search-${query}`, () => api.searchMaps(query), { enabled: query.length > 0 });
}

export function useMap(slug: string | undefined) {
  return useApiQuery(`map-${slug}`, () => api.fetchMap(slug!), { enabled: !!slug });
}

// ─── Chat ───────────────────────────────────────────────────────────────

export function useChats() {
  return useApiQuery("chats", () => api.fetchChats());
}

export function useChat(id: string | undefined) {
  return useApiQuery(`chat-${id}`, () => api.fetchChat(id!), { enabled: !!id });
}

export function useCreateChat() {
  return useApiMutation((title?: string) => api.createChat(title));
}
