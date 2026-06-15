export default function PageTitleBar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b px-6 py-3 ${className}`} style={{ borderColor: "var(--border)", background: "white" }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {children}
      </div>
    </div>
  );
}
