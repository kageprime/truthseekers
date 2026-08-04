"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * AppFooter — editorial footer rendered by AppShell on non-chat, non-overlay routes.
 * Uses the Antique Gold & Ink design tokens. Links are static/placeholder for now;
 * wire to real routes as they come online.
 */
const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Encyclopedia",
    links: [
      { label: "Articles", href: "/articles" },
      { label: "Maps", href: "/maps" },
      { label: "Contested claims", href: "/contested" },
      { label: "Open questions", href: "/gaps" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "Chat", href: "/chat/new" },
      { label: "Pricing", href: "/pricing" },
      { label: "Settings", href: "/settings" },
      { label: "Admin", href: "/admin" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

export default function AppFooter() {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  return (
    <footer
      className="shrink-0 border-t"
      style={{ borderColor: "var(--rule)", background: "var(--surface-elevated)" }}
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block"
                style={{ width: 10, height: 10, background: "var(--gold)", transform: "rotate(45deg)", boxShadow: "0 0 0 3px var(--gold-bg)" }}
              />
              <span className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>
                Truthseekers
              </span>
            </div>
            <p className="font-serif text-sm italic leading-relaxed" style={{ color: "var(--muted)" }}>
              The living encyclopedia — written by minds, verified by evidence.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2.5">
              <h4 className="small-caps text-[11px] font-semibold" style={{ color: "var(--subtle)", letterSpacing: "0.12em" }}>
                {col.title}
              </h4>
              {col.links.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="font-serif text-sm no-underline transition-colors hover:underline"
                    style={{ color: isActive ? "var(--gold)" : "var(--muted)" }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        {/* Legal line */}
        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t"
          style={{ borderColor: "var(--border-light)" }}
        >
          <p className="text-xs" style={{ color: "var(--subtle)" }}>
            © {year} Truthseekers · Veritas
          </p>
          <p className="text-xs italic font-serif" style={{ color: "var(--subtle)" }}>
            Powered by the nine-stage epistemic pipeline
          </p>
        </div>
      </div>
    </footer>
  );
}

