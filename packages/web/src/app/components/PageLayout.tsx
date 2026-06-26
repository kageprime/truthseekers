"use client";

import { type ReactNode } from "react";

export default function PageLayout({ children, maxWidthClass = "max-w-5xl", className = "" }: PageLayoutProps) {
  return (
    <div className={`w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 ${maxWidthClass} ${className}`}>
      {children}
    </div>
  );
}

interface PageLayoutProps {
  children: ReactNode;
  maxWidthClass?: string;
  className?: string;
}
