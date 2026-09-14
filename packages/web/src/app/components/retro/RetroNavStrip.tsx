"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { NAV_GROUPS, RETRO_ROUTES } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";

export default function RetroNavStrip() {
  const pathname = usePathname();
  const { user } = useAuth();
  const admin = user?.role === "owner" || user?.role === "admin";
  return (
    <nav aria-label="Site" className="r-navstrip flex items-center gap-x-1.5 gap-y-1 flex-wrap px-3 py-1.5 bg-[var(--r-nav-bg)] border-b border-[var(--r-border)] text-[11px] shrink-0 transition-colors duration-200">
      {NAV_GROUPS.map((g, gi) => (
        <Fragment key={g}>
          {gi > 0 && <span aria-hidden className="select-none text-[var(--r-muted)] opacity-60">|</span>}
          {RETRO_ROUTES.filter((r) => r.group === g && !r.hideInNav && (!r.adminOnly || admin)).map((r) => {
            const active = pathname === r.href || pathname.startsWith(r.href + "/");
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`px-2 py-0.5 no-underline border rounded-[var(--r-radius)] transition-colors ${
                  active
                    ? "bg-[var(--r-accent)] text-white border-[var(--r-accent)] font-semibold"
                    : "text-[var(--r-ink)] border-transparent hover:bg-black/5"
                }`}
                style={active ? { color: "#ffffff" } : undefined}
              >
                {r.label}
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
