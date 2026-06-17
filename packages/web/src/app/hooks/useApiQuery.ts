"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useApiQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean; onSuccess?: (data: T) => void; onError?: (err: Error) => void },
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      if (!mountedRef.current || controller.signal.aborted) return;
      setData(result);
      setLoading(false);
    } catch (err: any) {
      if (!mountedRef.current || controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }
    execute();
    return () => { mountedRef.current = false; abortRef.current?.abort(); };
  }, [key, execute, options?.enabled]);

  return { data, loading, error, refetch: execute };
}
