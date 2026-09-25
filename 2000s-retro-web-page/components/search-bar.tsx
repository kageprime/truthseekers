"use client";

import { Search } from "lucide-react";

// ponytail: one search bar — home, articles, and claims shared the same
// icon + underline input markup. Enter submits via onEnter when provided.
export function SearchBar({
  label,
  placeholder,
  value,
  onChange,
  onEnter,
  className = "",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 border-b-2 border-ink py-3 ${className}`}>
      <Search size={17} />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
