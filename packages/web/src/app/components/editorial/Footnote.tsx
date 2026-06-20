import { type ReactNode } from "react";

/**
 * Footnote — a single footnote entry rendered as small serif text.
 * On wide reading columns these collect into a margin sidenote
 * via the `.reading-column` grid in the article viewer.
 */
export default function Footnote({
  num,
  children,
  href,
}: {
  num: number;
  children: ReactNode;
  href?: string;
}) {
  return (
    <li className="footnote" id={href ? `fn-${href}` : undefined}>
      <span className="figure-num" style={{ marginRight: "0.35em" }}>{num}.</span>
      {children}
    </li>
  );
}
