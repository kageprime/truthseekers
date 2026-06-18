"use client";

import { createContext, useContext, useState, useRef, useEffect, type ReactNode, type FormEvent } from "react";

export interface HeaderSearchValue {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClear?: () => void;
  placeholder?: string;
}

interface HeaderSearchCtx {
  search: HeaderSearchValue | null;
  setSearch: (v: HeaderSearchValue | null) => void;
}

const HeaderSearchContext = createContext<HeaderSearchCtx>({ search: null, setSearch: () => {} });

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<HeaderSearchValue | null>(null);
  return <HeaderSearchContext.Provider value={{ search, setSearch }}>{children}</HeaderSearchContext.Provider>;
}

export function useHeaderSearch() {
  return useContext(HeaderSearchContext);
}

/** Helper hook: register search props for the current page, auto-cleanup on unmount */
export function usePageSearch(searchValue: HeaderSearchValue | null) {
  const { setSearch } = useHeaderSearch();
  const prevRef = useRef<HeaderSearchValue | null>(null);

  useEffect(() => {
    if (searchValue !== prevRef.current) {
      prevRef.current = searchValue;
      setSearch(searchValue);
    }
    return () => {
      prevRef.current = null;
      setSearch(null);
    };
  }, [searchValue, setSearch]);
}
