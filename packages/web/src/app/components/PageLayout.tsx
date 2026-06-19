"use client";

import { type ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex flex-row flex-1 min-h-0 relative overflow-x-hidden">
      <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-20 mix-blend-screen dark:mix-blend-lighten">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-accent/20 blur-[150px] animate-float" style={{ animationDuration: '12s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[40%] rounded-full bg-green-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {children}
      </div>
    </div>
  );
}
