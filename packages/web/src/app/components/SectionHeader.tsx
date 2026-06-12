export default function SectionHeader({
  emoji,
  title,
  accent = "var(--orange)",
  className = "",
}: {
  emoji?: string;
  title: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 mb-6 ${className}`}>
      {emoji && <span className="text-2xl">{emoji}</span>}
      <div>
        <h2 className="pixel text-sm" style={{ color: "var(--ink)" }}>{title}</h2>
        <div className="h-1 w-12 mt-1" style={{ background: accent }} />
      </div>
    </div>
  );
}
