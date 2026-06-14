"use client";

import Link from "next/link";
import TruthseekersLogo from "./TruthseekersLogo";
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
  ],
  onToggleSidebar,
  sidebarOpen,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b" style={{ borderColor: "#dadce0", background: "white" }}>
      {/* Wave background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill="var(--blue)" />
        </svg>
      </div>

      <div className="relative z-10 px-4 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="flex items-center justify-center rounded-lg hover:bg-[#f5f5f4] transition-colors"
                style={{ width: "32px", height: "32px", fontSize: "16px", color: "#5f6368" }}
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {sidebarOpen ? "◀" : "☰"}
              </button>
            )}
            <TruthseekersLogo />
          </div>

          <div className="flex items-center gap-2">
            <QueueIndicator />

            {/* Desktop nav links */}
            {links.length > 0 && (
              <div className="hidden sm:flex items-center gap-3 text-sm" style={{ color: "#5f6368" }}>
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="pixel text-[9px] px-3 py-3 sm:py-2 min-h-[44px] border-2 border-black shadow-[2px_2px_0_#1c1917] inline-flex items-center justify-center no-underline transition-all hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_#1c1917] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1c1917]"
                    style={{ background: "white", color: "var(--ink)", textTransform: "uppercase" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Mobile hamburger */}
            <HamburgerMenu>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-sm font-medium hover:bg-[#f1f3f4] rounded-lg transition-colors"
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
