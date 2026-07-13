"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { BASE } from "@/lib/constants";

// ─── Query helper ───────────────────────────────────────────────────────

function useApiQuery<T>(key: unknown[], fetcher: () => Promise<T>, options?: { enabled?: boolean; staleTime?: number }) {
  const result = useQuery<T, Error>({ queryKey: key, queryFn: fetcher, enabled: options?.enabled ?? true, staleTime: options?.staleTime });
  return { data: result.data, loading: result.isLoading, isRefetching: result.isFetching && !result.isPending, error: result.error?.message ?? null, refetch: result.refetch };
}

// ─── Mutation helper ────────────────────────────────────────────────────

function useApiMutation<TResult, TArgs extends any[] = []>(
  mutator: (...args: TArgs) => Promise<TResult>,
  options?: {
    onSuccess?: (data: TResult) => void;
    onMutate?: (args: TArgs) => Promise<unknown> | unknown;
    onError?: (error: Error, args: TArgs, context?: unknown) => void;
    onSettled?: () => void;
  }
) {
  const queryClient = useQueryClient();
  const mutation = useMutation<TResult, Error, TArgs>({
    mutationFn: (args: TArgs) => mutator(...args),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    onSettled: options?.onSettled,
    onMutate: options?.onMutate as any,
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
  return useApiQuery(["chat", id], () => api.fetchChat(id!), { enabled: !!id, staleTime: 30000 });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (title?: string) => api.createChat(title),
    {
      onMutate: async ([title]) => {
        await queryClient.cancelQueries({ queryKey: ["chats"] });
        const prev = queryClient.getQueryData(["chats"]);
        queryClient.setQueryData(["chats"], (old: any) => {
          const optimistic = { id: "new-" + Date.now(), title: title || "New Chat", createdAt: new Date().toISOString() };
          return [optimistic, ...(old ?? [])];
        });
        return { prev };
      },
      onError: (_e, _a, context: any) => {
        if (context?.prev) queryClient.setQueryData(["chats"], context.prev);
      },
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

// ── Profile ──────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const fromCookie = document.cookie.match(/(?:^|; )truthseekers_token=([^;]*)/);
  const token = fromCookie ? decodeURIComponent(fromCookie[1]) : localStorage.getItem("truthseekers_token");
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function useUpdateProfile() {
  return useCallback(async (name: string, avatar?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, avatar: avatar || undefined }),
      });
      return res.ok;
    } catch { return false; }
  }, []);
}

// ── Tracking ─────────────────────────────────────────────────

export function useTrackView() {
  return useCallback((slug: string) => {
    fetch(`${BASE}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, event: "view" }),
    }).catch(() => {});
  }, []);
}

// ── Models (LLM Gateway) ──

export function useModels() {
  return useApiQuery(["models"], () => api.fetchModels());
}

// ── Connectors (Executor Gateway) ──

export function useConnectors() {
  return useApiQuery(["connectors"], () => api.fetchConnectors());
}

// ── Credentials (hot-swap) ──

export function useUpdateCredential() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ service, token }: { service: string; token: string }) => api.updateCredential(service, token),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connectors"] }) },
  );
}

// ── LLM Usage Stats ──

export function useUsageStats() {
  return useApiQuery(["usage"], () => api.fetchUsageStats());
}

