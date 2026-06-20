import { type ReactNode } from "react";

/**
 * FigurePlate — a bordered archival frame around an image/media
 * with an auto-numbered "Fig. N — caption" in serif small-caps.
 *
 * Pass a stable `id` so figure numbering is deterministic within
 * the page; consumers track their own counter and pass `num`.
 */
export default function FigurePlate({
  num,
  caption,
  children,
  className = "",
}: {
  num?: number;
  caption?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`figure-plate ${className}`}>
      <div className="figure-media">{children}</div>
      {(num != null || caption) && (
        <figcaption className="figure-caption">
          {num != null && <span className="figure-num">Fig. {num}</span>}
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
