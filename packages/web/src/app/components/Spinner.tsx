export default function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full border-2 animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: "color-mix(in srgb, var(--border) 40%, transparent)",
        borderTopColor: "var(--accent)",
      }}
    />
  );
}
