"use client";
// ponytail: one route registry — sidebar, palette, breadcrumbs all read this. Nav can't drift.

export interface RetroRoute {
  href: string;
  label: string;
  icon: string;
  group: "Encyclopedia" | "Create" | "Account";
  keywords: string;
  hideInNav?: boolean;
  adminOnly?: boolean;
}

// ponytail: account roles owner/admin see admin surfaces; everyone else doesn't.
export function canSeeAdmin(role?: string | null): boolean {
  return role === "owner" || role === "admin";
}

export const RETRO_ROUTES: RetroRoute[] = [
  { href: "/", label: "Home", icon: "home", group: "Encyclopedia", keywords: "home landing start index" },
  { href: "/articles", label: "Articles", icon: "book", group: "Encyclopedia", keywords: "browse encyclopedia list all" },
  { href: "/finder", label: "Claim Finder", icon: "search", group: "Encyclopedia", keywords: "verify claim lookup search evidence verdict" },
  { href: "/claim-graph", label: "Claim Map", icon: "graph", group: "Encyclopedia", keywords: "graph map atlas claims territories global" },
  { href: "/contested", label: "Contested", icon: "scale", group: "Encyclopedia", keywords: "disputed fault lines contradiction" },
  { href: "/gaps", label: "Open Questions", icon: "question", group: "Encyclopedia", keywords: "gaps missing evidence research wanted" },
  { href: "/stale", label: "Stale Watch", icon: "clock", group: "Encyclopedia", keywords: "stale freshness outdated old" },
  { href: "/maps", label: "Maps", icon: "map", group: "Encyclopedia", keywords: "atlas geography territories" },
  { href: "/article/new", label: "New Article", icon: "pencil", group: "Create", keywords: "write create generate article" },
  { href: "/chat/new", label: "New Chat", icon: "chat", group: "Create", keywords: "chat ask agent research conversation" },
  { href: "/queue", label: "Queue", icon: "list", group: "Create", keywords: "queue jobs pending generation status" },
  { href: "/pricing", label: "Pricing", icon: "tag", group: "Account", keywords: "pricing plans billing pay pro enterprise" },
  { href: "/admin", label: "Admin", icon: "wrench", group: "Account", keywords: "admin settings seed ops", adminOnly: true },
  { href: "/settings", label: "Settings", icon: "gear", group: "Account", keywords: "settings preferences profile theme" },
  { href: "/login", label: "Sign in", icon: "chat", group: "Account", keywords: "login signin sign in auth", hideInNav: true },
  { href: "/onboarding", label: "Onboarding", icon: "chat", group: "Account", keywords: "onboarding welcome setup", hideInNav: true },
];

export const NAV_GROUPS = ["Encyclopedia", "Create", "Account"] as const;
