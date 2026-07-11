"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastVariant = "default" | "success" | "error" | "warning";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastVariant, string> = {
  default: "ℹ️",
  success: "✓",
  error: "✗",
  warning: "⚠",
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = ++nextId;
    const toast: Toast = { id, title: t.title, description: t.description, variant: t.variant ?? "default" };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 9999, display: "flex", flexDirection: "column", gap: "0.5rem", pointerEvents: "none" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto rounded-xl px-4 py-3 shadow-lg border min-w-[280px] max-w-[400px]"
              style={{
                background: "var(--surface-elevated)",
                borderColor: "var(--border)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-sm mt-0.5 shrink-0">
                  {t.variant === "success" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
                  {t.variant === "error" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oxblood)" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
                  {t.variant === "warning" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                  {t.variant === "default" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{t.title}</p>
                  {t.description && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.description}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
