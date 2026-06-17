"use client";

import { useState, useRef, useCallback } from "react";

export function useApiMutation<TResult, TArgs extends any[] = []>(
  mutator: (...args: TArgs) => Promise<TResult>,
  options?: { onSuccess?: (data: TResult) => void; onError?: (err: Error) => void },
) {
  const [data, setData] = useState<TResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setLoading(true);
    setError(null);

    try {
      const result = await mutator(...args);
      if (!mountedRef.current) return undefined;
      setData(result);
      setLoading(false);
      options?.onSuccess?.(result);
      return result;
    } catch (err: any) {
      if (!mountedRef.current) return undefined;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
      options?.onError?.(err instanceof Error ? err : new Error(msg));
      return undefined;
    }
  }, [mutator, options?.onSuccess, options?.onError]);

  return { data, loading, error, mutate, setData, reset: () => { setData(undefined); setError(null); } };
}
