"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { BASE } from "@/lib/constants";

// ─── Query helper ───────────────────────────────────────────────────────

type UseApiQueryOptions = {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
};

function useApiQuery<T>(key: unknown[], fetcher: () => Promise<T>, options?: UseApiQueryOptions) {
  const result = useQuery<T, Error>({
    queryKey: key,
    queryFn: fetcher,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  });
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

export function useUpdateProfile() {
  return useApiMutation(
    ({ name, avatar }: { name: string; avatar?: string }) => api.updateProfile(name, avatar),
  );
}

// ── Tracking ─────────────────────────────────────────────────

export function useTrackView() {
  return useCallback((slug: string) => {
    api.trackView(slug);
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

// ── Epistemic: Contested / Gaps / Stale / Freshness / Refresh-diff ──

export function useContestedClaims(limit = 50) {
  return useApiQuery(["contested", limit], () => api.fetchContestedClaims(limit));
}

export function useAllGaps() {
  return useApiQuery(["gaps", "all"], () => api.fetchAllGaps());
}

export function useStaleArticles(limit = 50) {
  return useApiQuery(["stale", limit], () => api.fetchStaleArticles(limit));
}

export function useArticleFreshness(slug: string | undefined) {
  return useApiQuery(["article", slug, "freshness"], () => api.fetchArticleFreshness(slug!), { enabled: !!slug });
}

export function useRefreshDiff(slug: string | undefined) {
  return useApiQuery(["article", slug, "refresh-diff"], () => api.fetchRefreshDiff(slug!), { enabled: !!slug });
}

export function useArticleGraph(slug: string | undefined) {
  return useApiQuery(["article", slug, "graph"], () => api.fetchArticleGraph(slug!), { enabled: !!slug });
}

export function useArticleClaimGraph(slug: string | undefined) {
  return useApiQuery(["article", slug, "claim-graph"], () => api.fetchArticleClaimGraph(slug!), { enabled: !!slug });
}

export function useArticleEpistemic(slug: string | undefined) {
  return useApiQuery(["article", slug, "epistemic"], () => api.fetchArticleEpistemic(slug!), { enabled: !!slug, staleTime: 60_000 });
}

export function useGlobalClaimGraph(limit = 150, minContradiction = 0) {
  return useApiQuery(["claim-graph", "global", limit, minContradiction], () => api.fetchGlobalClaimGraph(limit, minContradiction), { staleTime: 60_000 });
}

export function useArticleClaims(slug: string | undefined) {
  return useApiQuery(["article", slug, "claims"], () => api.fetchArticleClaims(slug!), { enabled: !!slug });
}

export function useArticleGaps(slug: string | undefined) {
  return useApiQuery(["article", slug, "gaps"], () => api.fetchArticleGaps(slug!), { enabled: !!slug });
}

export function useClaimEvidence(claimId: string | undefined) {
  return useApiQuery(["claim", claimId, "evidence"], () => api.fetchClaimEvidence(claimId!), { enabled: !!claimId });
}

// ── Gap mutations ──

export function useUpvoteGap() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (gapId: string) => api.upvoteGap(gapId),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gaps", "all"] }) },
  );
}

export function useSubmitGapEvidence() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ gapId, url, note }: { gapId: string; url: string; note: string }) => api.submitGapEvidence(gapId, url, note),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gaps", "all"] }) },
  );
}

// ── Queue (poll + cancel) ──

export function useQueue(refetchInterval = 5000) {
  return useApiQuery(["queue"], () => api.fetchQueue(), { refetchInterval });
}

export function useCancelQueueJob() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (slug: string) => api.cancelQueueJob(slug),
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] }) },
  );
}

// ── Article status check (one-shot, for generate button) ──

export function useCheckArticleStatus() {
  return useApiMutation(
    (slug: string) => api.fetchArticleStatus(slug),
  );
}

// ── Article Resolve (paused review flow) ──

export function useResolveArticle() {
  return useApiMutation(
    ({ slug, action }: { slug: string; action: "approve" | "correct" }) => api.resolveArticle(slug, action),
  );
}

// ── Health (home page stats) ──

export function useHealth() {
  return useApiQuery(["health"], () => api.fetchHealth(), { staleTime: 60_000 });
}

// ── Auth mutations ──

export function useLoginEmail() {
  return useApiMutation(
    (email: string) => api.loginEmail(email),
  );
}

export function useVerifyOTP() {
  return useApiMutation(
    ({ email, code }: { email: string; code: string }) => api.verifyOTP(email, code),
  );
}

export function useOnboard() {
  return useApiMutation(
    ({ token, name }: { token: string; name: string }) => api.onboard(token, name),
  );
}

export function useFetchMe() {
  return useApiMutation(
    (token: string) => api.fetchMe(token),
  );
}

// ── Stripe (billing) ──

export function useStripeCheckout() {
  return useApiMutation(
    (priceId: string) => api.stripeCheckout(priceId),
  );
}

export function useStripePortal() {
  return useApiMutation(
    () => api.stripePortal(),
  );
}

