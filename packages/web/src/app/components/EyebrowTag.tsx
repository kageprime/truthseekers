interface EyebrowTagProps {
  label: string;
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function EyebrowTag({ label, dot = true, className = "", children }: EyebrowTagProps) {
  return (
    <span className={`eyebrow ${className}`}>
      {dot && <span className="eyebrow-dot" aria-hidden />}
      <span>{children ?? label}</span>
    </span>
  );
}
