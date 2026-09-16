"use client";

import React from "react";
import AeroWindow from "./AeroWindow";
import AeroButton from "./AeroButton";

export interface AeroDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AeroDialog({
  open,
  title,
  onClose,
  children,
  footer,
}: AeroDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg">
        <AeroWindow title={title} onClose={onClose}>
          <div className="p-4 bg-white/95 text-[12px] text-slate-800">{children}</div>
          <div className="px-4 py-2.5 bg-slate-100/90 border-t border-slate-300 flex items-center justify-end gap-2">
            {footer ? (
              footer
            ) : (
              <AeroButton onClick={onClose} variant="primary">
                OK
              </AeroButton>
            )}
          </div>
        </AeroWindow>
      </div>
    </div>
  );
}
