"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";

// ─── Query helper ───────────────────────────────────────────────────────

function useApiQuery<T>(key: unknown[], fetcher: () => Promise<T>, options?: { enabled?: boolean }) {
  const result = useQuery<T, Error>({ queryKey: key, queryFn: fetcher, enabled: options?.enabled ?? true });
  return { data: result.data, loading: result.isLoading || result.isFetching, error: result.error?.message ?? null, refetch: result.refetch };
}

// ─── Mutation helper ────────────────────────────────────────────────────

function useApiMutation<TResult, TArgs extends any[] = []>(
  mutator: (...args: TArgs) => Promise<TResult>,
  options?: { onSuccess?: (data: TResult) => void }
) {
  const mutation = useMutation<TResult, Error, TArgs>({
    mutationFn: (args: TArgs) => mutator(...args),
    onSuccess: options?.onSuccess,
  });
  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    try { return await mutation.mutateAsync(args); } catch { return undefined; }
  }, [mutation.mutateAsync]);
  return { data: mutation.data, loading: mutation.isPending, error: mutation.error?.message ?? null, mutate, setData: () => {}, reset: mutation.reset };
}

// ─── Articles ───────────────────────────────────────────────────────────

export function useArticles(offset = 0, limit = 50) {
  return useApiQuery(["articles", offset, limit], () => api.fetchArticles(offset, limit));
}

export function useArticleSearch(query: string) {
  return useApiQuery(["articles", "search", query], () => api.searchArticles(query), { enabled: query.length > 0 });
}

export function useArticle(slug: string | undefined) {
  return useApiQuery(["article", slug], () => api.fetchArticle(slug!), { enabled: !!slug });
}

export function useArticleStatus(slug: string | undefined) {
  return useApiQuery(["article", slug, "status"], () => api.fetchArticleStatus(slug!), { enabled: !!slug });
}

export function useQuota() {
  return useApiQuery(["quota"], () => api.fetchQuota());
}

export function useGenerateArticle() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ slug, persona }: { slug: string; persona?: string }) => api.generateArticle(slug, persona),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["articles"] });
        queryClient.invalidateQueries({ queryKey: ["quota"] });
      },
    }
  );
}

export function useRefreshArticle() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (slug: string) => api.refreshArticle(slug),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["articles"] });
        queryClient.invalidateQueries({ queryKey: ["quota"] });
      },
    }
  );
}

// ─── Maps ───────────────────────────────────────────────────────────────

export function useMaps(limit = 50, offset = 0) {
  return useApiQuery(["maps", limit, offset], () => api.fetchMaps(limit, offset));
}

export function useMapSearch(query: string) {
  return useApiQuery(["maps", "search", query], () => api.searchMaps(query), { enabled: query.length > 0 });
}

export function useMap(slug: string | undefined) {
  return useApiQuery(["map", slug], () => api.fetchMap(slug!), { enabled: !!slug });
}

// ─── Chat ───────────────────────────────────────────────────────────────

export function useChats() {
  return useApiQuery(["chats"], () => api.fetchChats());
}

export function useChat(id: string | undefined) {
  return useApiQuery(["chat", id], () => api.fetchChat(id!), { enabled: !!id });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (title?: string) => api.createChat(title),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      },
    }
  );
}

// ── Admin ────────────────────────────────────────────────────────────

export function useAdminSettings() {
  const queryClient = useQueryClient();
  const settings = useApiQuery(["admin", "settings"], () => api.fetchSettings());
  const mutation = useApiMutation(
    (s: Record<string, string>) => api.updateSettings(s),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "settings"] }),
    }
  );
  return { ...settings, updateSettings: mutation.mutate, updating: mutation.loading };
}

export function useFeaturedArticles() {
  return useApiQuery(["admin", "featured"], () => api.fetchFeaturedArticles());
}

