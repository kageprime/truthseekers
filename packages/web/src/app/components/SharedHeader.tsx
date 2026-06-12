"use client";

import { useState } from "react";
import TruthseekersLogo from "./TruthseekersLogo";
import QueueIndicator from "./QueueIndicator";
import HamburgerMenu from "./HamburgerMenu";

interface HeaderProps {
  links?: Array<{ label: string; href: string }>;
}

export default function SharedHeader({
  links = [
    { label: "Home", href: "/" },
    { label: "Maps", href: "/maps" },
    { label: "New Article", href: "/article/new" },
    { label: "Queue", href: "/queue" },
  ],
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ borderColor: "#dadce0", background: "white" }}>
      {/* Wave background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill="var(--blue)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <TruthseekersLogo />

          <div className="flex items-center gap-3">
            <QueueIndicator />

            {/* Desktop nav links */}
            {links.length > 0 && (
              <div className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "#5f6368" }}>
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="hover:text-[#1a1a1a] hover:underline transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {/* Mobile hamburger */}
            <HamburgerMenu>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-sm font-medium hover:bg-[#f1f3f4] rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </HamburgerMenu>
          </div>
        </div>

      </div>
    </header>
  );
}
