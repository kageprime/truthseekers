"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
  open: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  const open = useCallback(() => setOpen(true), []);
  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close, open }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
