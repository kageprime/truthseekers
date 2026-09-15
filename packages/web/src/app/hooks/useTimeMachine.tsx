"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type HistoricalEra = "Present" | "500 BCE" | "1500 CE" | "1900 CE" | "1945" | string;

interface TimeMachineValue {
  activeEra: HistoricalEra;
  isActive: boolean;
  isOpen: boolean;
  setEra: (era: HistoricalEra) => void;
  toggleOpen: () => void;
  open: () => void;
  close: () => void;
  reset: () => void;
}

const TimeMachineContext = createContext<TimeMachineValue | null>(null);

export function TimeMachineProvider({ children }: { children: ReactNode }) {
  const [activeEra, setActiveEra] = useState<HistoricalEra>("Present");
  const [isOpen, setIsOpen] = useState(false);

  const isActive = activeEra !== "Present";

  const setEra = useCallback((era: HistoricalEra) => {
    setActiveEra(era);
  }, []);

  const toggleOpen = useCallback(() => setIsOpen((o) => !o), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const reset = useCallback(() => {
    setActiveEra("Present");
    setIsOpen(false);
  }, []);

  return (
    <TimeMachineContext.Provider
      value={{
        activeEra,
        isActive,
        isOpen,
        setEra,
        toggleOpen,
        open,
        close,
        reset,
      }}
    >
      {children}
    </TimeMachineContext.Provider>
  );
}

export function useTimeMachine(): TimeMachineValue {
  const ctx = useContext(TimeMachineContext);
  if (!ctx) {
    // Graceful fallback for non-provider contexts
    return {
      activeEra: "Present",
      isActive: false,
      isOpen: false,
      setEra: () => {},
      toggleOpen: () => {},
      open: () => {},
      close: () => {},
      reset: () => {},
    };
  }
  return ctx;
}
