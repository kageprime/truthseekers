"use client";

import Link from "next/link";
import QueueIndicator from "./QueueIndicator";
import HamburgerMenu from "./HamburgerMenu";

interface HeaderProps {
  links?: Array<{ label: string; href: string }>;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function SharedHeader({
  links = [
    { label: "Queue", href: "/queue" },
    { label: "Maps", href: "/maps" },
    { label: "Articles", href: "/articles" },
  ],
  onToggleSidebar,
  sidebarOpen,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b-2 border-black"
      style={{ background: "var(--warm)" }}
    >
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="flex items-center justify-center w-11 h-11 border-2 border-black shadow-[2px_2px_0_#1c1917] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#1c1917] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1c1917]"
                style={{ background: "white", fontSize: "14px" }}
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {sidebarOpen ? "◀" : "☰"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <QueueIndicator />

            {links.length > 0 && !sidebarOpen && (
              <div className="hidden sm:flex items-center gap-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="pixel text-[9px] px-3 py-2 border-2 border-black shadow-[2px_2px_0_#1c1917] inline-flex items-center justify-center no-underline transition-all hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_#1c1917] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1c1917]"
                    style={{ background: "white", color: "var(--ink)", textTransform: "uppercase" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <HamburgerMenu>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-sm font-medium hover:bg-[var(--skeleton)] rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </HamburgerMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
