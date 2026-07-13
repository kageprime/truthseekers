"use client";

import { useSyncExternalStore, useCallback, useRef } from "react";

// A tiny pub/sub store using React 19's useSyncExternalStore.
// No dependencies, no middleware, no boilerplate.
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (fn: (prev: T) => T) => {
      state = fn(state);
      listeners.forEach((l) => l());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Hook to consume a slice of store state with automatic re-render only
// when the selected value changes.
export function useStore<T, R>(store: ReturnType<typeof createStore<T>>, selector: (state: T) => R): R {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => selectorRef.current(store.getState()), [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
