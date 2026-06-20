/**
 * Fleuron — a centered gold ornament divider.
 * Evokes classical encyclopedia section breaks.
 */
export default function Fleuron({ ornament = "❦", className = "" }: { ornament?: string; className?: string }) {
  return <div className={`fleuron ${className}`} aria-hidden="true">{ornament}</div>;
}
