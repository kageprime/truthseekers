import type { ReactNode } from "react";

interface ContentCardProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  className?: string;
}

export default function ContentCard({ children, header, footer, maxWidth = "max-w-4xl", className = "" }: ContentCardProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {header && <div className="shrink-0 border-b border-border/40"><div className={`${maxWidth} w-full mx-auto`}>{header}</div></div>}
      <div className={`${maxWidth} w-full mx-auto flex-1 flex flex-col min-h-0 bg-surface ${className}`}>
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
      {footer && <div className="border-t border-border/40"><div className={`${maxWidth} w-full mx-auto`}>{footer}</div></div>}
    </div>
  );
}
