"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { NAV_GROUPS, RETRO_ROUTES } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";

// ponytail: one-line site nav for self-wrapped pages (map, chat, article). Sidebar pages don't render this.
export default function RetroNavStrip() {
  const pathname = usePathname();
  const { user } = useAuth();
  const admin = user?.role === "owner" || user?.role === "admin";
  return (
    <nav aria-label="Site" className="flex items-center gap-x-1 gap-y-0.5 flex-wrap px-2 py-1 bg-[#e8e0c5] border-b-[2px] border-[#8a7f68] text-[11px] shrink-0">
      {NAV_GROUPS.map((g, gi) => (
        <Fragment key={g}>
          {gi > 0 && <span aria-hidden className="select-none" style={{ color: "#8a7f68" }}>|</span>}
          {RETRO_ROUTES.filter((r) => r.group === g && !r.hideInNav && (!r.adminOnly || admin)).map((r) => {
            const active = pathname === r.href || pathname.startsWith(r.href + "/");
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`px-1.5 py-0.5 no-underline border ${active ? "bg-[#0a2a5e] text-white border-[#0a2a5e] font-bold" : "text-black border-transparent hover:bg-[#d6cfae]"}`}
                style={active ? { color: "#fff" } : undefined}
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
