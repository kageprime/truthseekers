"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, title, children, className = "" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`relative rounded-xl shadow-2xl border w-full max-w-lg max-h-[85vh] overflow-y-auto ${className}`}
            style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>{title}</h2>
                <button onClick={onClose} className="p-1 rounded-md hover:bg-accent-bg/30 cursor-pointer" style={{ color: "var(--muted)", background: "none", border: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            )}
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
