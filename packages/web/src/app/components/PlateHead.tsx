import type { ReactNode } from "react";

// ponytail: one masthead — folio pair / h1 / deck / rule + optional row.
// Folio slots carry metadata (counts, dates, method), never title rephrase.
export default function PlateHead({
  folioLeft,
  folioRight,
  title,
  deck,
  children,
}: {
  folioLeft?: ReactNode;
  folioRight?: ReactNode;
  title: ReactNode;
  deck?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="plate-head">
      <div className="plate-folio">
        <span>{folioLeft}</span>
        <span>{folioRight}</span>
      </div>
      <h1 className="plate-title">{title}</h1>
      {deck && <p className="plate-deck">{deck}</p>}
      <div className="plate-rule" />
      {children}
    </div>
  );
}
