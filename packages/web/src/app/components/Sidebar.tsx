"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useChats, useCreateChat } from "../hooks";
import { IconChat, IconBook, IconMap, IconClock, IconPlus } from "./Icons";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeId?: string;
  defaultCollapsed?: boolean;
}

export default function Sidebar({ open, onClose, activeId, defaultCollapsed = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const { data: conversations = [], loading } = useChats();
  const { mutate: createChat } = useCreateChat();

  // section collapse states
  const [exploreOpen, setExploreOpen] = useState(true);
  const [convOpen, setConvOpen] = useState(true);

  async function handleNew() {
    const conv = await createChat();
    if (conv) {
      router.push(`/chat/${conv.id}`);
    }
    onClose();
  }

  if (collapsed) {
    return (
      <>
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden="true" />
        )}
        <div className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 shrink-0 border-r transition-all duration-200 ease-out sidebar-panel w-16`}
          style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}
        >
          <aside className="flex flex-col items-center h-full w-full backdrop-blur-xl pt-4 gap-4" style={{ background: "color-mix(in srgb, var(--surface) 85%, transparent)" }}>
            <Link href="/" className="no-underline">
              <img src="/logo-icon.png" alt="Truthseekers" className="w-9 h-9" style={{ objectFit: "contain" }} />
            </Link>
            {NAV_ITEMS.map((item) => {
              const IconComp = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className="flex items-center justify-center w-10 h-10 rounded-lg no-underline transition-all duration-150 hover:bg-[var(--accent-bg)]/40"
                  style={{ color: active ? "var(--accent)" : "var(--muted)" }}>
                  <IconComp size={20} />
                </Link>
              );
            })}
            <button onClick={() => setCollapsed(false)} className="mt-auto mb-3 btn-icon btn-ghost" aria-label="Expand sidebar" style={{ width: 28, height: 28 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden="true" />
      )}
      <div className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 shrink-0 border-r transition-all duration-200 ease-out sidebar-panel w-64`}
        style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}
      >
        <aside className="flex flex-col h-full w-full backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--surface) 85%, transparent)" }}>
          {/* Brand */}
          <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3">
            <Link href="/" className="flex items-center no-underline min-w-0 gap-3">
              <img src="/logo-icon.png" alt="" className="w-9 h-9 shrink-0" style={{ objectFit: "contain" }} />
              <span className="font-semibold text-sm tracking-tight" style={{ color: "var(--ink)" }}>Truthseekers</span>
            </Link>
          </div>

          {/* Explore section */}
          <div className="shrink-0 px-2.5">
            <button onClick={() => setExploreOpen((o) => !o)}
              className="w-full flex items-center justify-between h-9 px-2.5 rounded-lg hover:bg-[var(--accent-bg)]/30 transition-colors text-xs font-medium tracking-wider uppercase"
              style={{ color: "var(--subtle)" }}
            >
              <span>Explore</span>
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${exploreOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <CollapsiblePanel open={exploreOpen}>
              <div className="relative ml-[13px] pl-[13px] pt-0.5 pb-0.5">
                <div className="absolute left-0 top-1 bottom-1 w-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                {NAV_ITEMS.map((item) => {
                  const IconComp = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      className="relative flex items-center h-9 no-underline group"
                      style={{ color: active ? "var(--accent)" : "var(--muted)" }}
                    >
                      <span className="absolute -left-[13px] top-1/2 w-[10px] h-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                      <span className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${active ? "" : "group-hover:bg-[var(--accent-bg)]/20"}`}
                        style={active ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)" } : {}}
                      >
                        <IconComp size={16} />
                        <span className={active ? "font-medium" : ""}>{item.label}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CollapsiblePanel>
          </div>

          {/* Conversations section */}
          <div className="shrink-0 px-2.5 mt-1">
            <button onClick={() => setConvOpen((o) => !o)}
              className="w-full flex items-center justify-between h-9 px-2.5 rounded-lg hover:bg-[var(--accent-bg)]/30 transition-colors text-xs font-medium tracking-wider uppercase"
              style={{ color: "var(--subtle)" }}
            >
              <span>History</span>
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${convOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <CollapsiblePanel open={convOpen}>
              <div className="relative ml-[13px] pl-[13px] pt-0.5 pb-0.5">
                <div className="absolute left-0 top-1 bottom-1 w-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                {/* New Chat */}
                <div className="relative flex items-center h-9">
                  <span className="absolute -left-[13px] top-1/2 w-[10px] h-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                  <button onClick={handleNew}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--accent-bg)]/20"
                    style={{ color: "var(--accent)" }}
                  >
                    <IconPlus size={16} />
                    <span>New Chat</span>
                  </button>
                </div>
                {/* Conversations */}
                {loading && (
                  <div className="relative flex items-center justify-center h-9">
                    <span className="absolute -left-[13px] top-1/2 w-[10px] h-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                    <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
                  </div>
                )}
                {!loading && conversations.length === 0 && (
                  <div className="relative flex items-center h-9 px-2.5 text-xs" style={{ color: "var(--subtle)" }}>
                    <span className="absolute -left-[13px] top-1/2 w-[10px] h-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                    No conversations yet
                  </div>
                )}
                {conversations.map((conv) => {
                  const active = conv.id === activeId;
                  return (
                    <div key={conv.id} className="relative flex items-center h-9">
                      <span className="absolute -left-[13px] top-1/2 w-[10px] h-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                      <Link href={`/chat/${conv.id}`}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm no-underline transition-colors ${active ? "" : "hover:bg-[var(--accent-bg)]/20"}`}
                        style={{ color: active ? "var(--accent)" : "var(--muted)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate" style={{ color: active ? "var(--ink)" : "var(--muted)" }}>{conv.title}</div>
                        </div>
                        <span className="shrink-0 text-[11px] opacity-50">{conv.messageCount}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </CollapsiblePanel>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}>
            <span className="text-[11px]" style={{ color: "var(--subtle)" }}>v1.0.0</span>
            <div className="flex items-center gap-2">
              <img src="/logo-text.png" alt="Truthseekers" style={{ height: 12, width: "auto", objectFit: "contain", opacity: 0.35 }} />
              <button onClick={() => setCollapsed(true)} className="btn-icon btn-ghost" aria-label="Collapse sidebar" style={{ width: 24, height: 24 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

const NAV_ITEMS = [
  { label: "Chat", href: "/", icon: IconChat },
  { label: "Articles", href: "/articles", icon: IconBook },
  { label: "Maps", href: "/maps", icon: IconMap },
  { label: "Queue", href: "/queue", icon: IconClock },
];

function CollapsiblePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(open ? "auto" : "0px");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      el.style.height = h + "px";
      const onEnd = () => { if (el.dataset.open === "true") el.style.height = "auto"; };
      el.addEventListener("transitionend", onEnd, { once: true });
      el.dataset.open = "true";
    } else {
      el.style.height = el.scrollHeight + "px";
      requestAnimationFrame(() => { el.style.height = "0px"; });
      el.dataset.open = "false";
    }
  }, [open]);

  return (
    <div ref={ref} data-open={open ? "true" : "false"}
      className="overflow-hidden transition-[height] duration-300 ease-out"
      style={{ height }}
    >
      {children}
    </div>
  );
}
