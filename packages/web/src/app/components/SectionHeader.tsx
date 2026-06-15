import type { FC, SVGProps } from "react";

export default function SectionHeader({
  emoji,
  icon: Icon,
  title,
  accent = "var(--accent)",
  className = "",
}: {
  emoji?: string;
  icon?: FC<SVGProps<SVGSVGElement> & { size?: number }>;
  title: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 mb-6 ${className}`}>
      {Icon && <Icon size={22} />}
      {emoji && <span className="text-xl">{emoji}</span>}
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>{title}</h2>
        <div className="h-0.5 w-10 mt-1 rounded-full" style={{ background: accent }} />
      </div>
    </div>
  );
}
