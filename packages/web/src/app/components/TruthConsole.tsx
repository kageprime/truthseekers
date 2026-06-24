"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import Spinner from "./Spinner";
import { IconSearch, IconGlobe, IconBook, IconMap, IconImage, IconCheck, IconLink, IconPlus, IconDatabase, IconLightning, IconChat, IconX, IconChevronRight } from "./Icons";
import type { AgentEvent } from "./ProcessViewer";

// ─── Icon / label / color registry ────────────────────────────────

const TOOL_ICONS: Record<string, (size?: number) => React.ReactNode> = {
  web_search: (s) => <IconSearch size={s ?? 14} />,
  websearch: (s) => <IconSearch size={s ?? 14} />,
  tavilySearch: (s) => <IconSearch size={s ?? 14} />,
  firecrawl_search: (s) => <IconSearch size={s ?? 14} />,
  webfetch: (s) => <IconGlobe size={s ?? 14} />,
  get_article: (s) => <IconBook size={s ?? 14} />,
  article_search: (s) => <IconBook size={s ?? 14} />,
  get_map: (s) => <IconMap size={s ?? 14} />,
  generate_image: (s) => <IconImage size={s ?? 14} />,
  verify_citation: (s) => <IconCheck size={s ?? 14} />,
  suggest_related: (s) => <IconLink size={s ?? 14} />,
  create_article: (s) => <IconPlus size={s ?? 14} />,
  task: (s) => <IconLightning size={s ?? 14} />,
  mem_store: (s) => <IconDatabase size={s ?? 14} />,
  mem_recall: (s) => <IconDatabase size={s ?? 14} />,
  think: (s) => <IconChat size={s ?? 14} />,
};

const TOOL_COLORS: Record<string, string> = {
  web_search: "var(--tool-search)",
  websearch: "var(--tool-search)",
  tavilySearch: "var(--tool-search)",
  firecrawl_search: "var(--tool-search)",
  webfetch: "var(--tool-fetch)",
  get_article: "var(--tool-article)",
  article_search: "var(--tool-article)",
  get_map: "var(--tool-verify)",
  generate_image: "var(--tool-image)",
  verify_citation: "var(--tool-verify)",
  suggest_related: "var(--tool-related)",
  create_article: "var(--tool-article)",
  task: "var(--task)",
  mem_store: "var(--tool-memory)",
  mem_recall: "var(--tool-memory)",
  think: "var(--tool-think)",
};

function toolIcon(name: string, size?: number): React.ReactNode {
  return TOOL_ICONS[name]?.(size) ?? <IconLightning size={size ?? 14} />;
}
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    firecrawl_search: "Web Search", tavilySearch: "Web Search",
    web_search: "Web Search", websearch: "Web Search",
    webfetch: "Fetch URL", get_article: "Lookup Article",
    article_search: "Search Articles", get_map: "Lookup Map",
    generate_image: "Generate Image", verify_citation: "Verify Citation",
    suggest_related: "Related Articles", create_article: "Generate Article",
    task: "Sub-agent", mem_store: "Remember", mem_recall: "Recall",
    think: "Thinking",
  };
  return labels[name] ?? name.replace(/_/g, " ");
}
function toolColor(name: string): string {
  return TOOL_COLORS[name] ?? "var(--accent)";
}
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Data helpers ──────────────────────────────────────────────────

interface RichResult {
  kind: "search" | "image" | "verdict" | "article" | "fetch" | "map" | "generic" | "task";
  text: string;
  items?: { title: string; snippet: string; url: string }[];
  imageUrl?: string;
  imageAlt?: string;
  verdict?: { label: string; supported: boolean; partial?: boolean };
  confidence?: number;
  articleTitle?: string;
  articleSlug?: string;
  blockCount?: number;
  url?: string;
  contentPreview?: string;
}

function parseRichResult(name: string, raw: unknown): RichResult {
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  const fallback: RichResult = { kind: "generic", text: str.slice(0, 300) };

  if (!str) return { kind: "generic", text: "" };

  // Try to parse JSON
  let parsed: any;
  try { parsed = JSON.parse(str); } catch { return fallback; }
  if (!parsed || typeof parsed !== "object") return fallback;

  // Search results
  const results = parsed.results ?? (Array.isArray(parsed) ? parsed : null);
  if (Array.isArray(results) && results.length > 0) {
    return {
      kind: "search",
      text: `${results.length} results`,
      items: results.slice(0, 8).map((r: any) => ({
        title: r.title || r.name || "Untitled",
        snippet: r.snippet || r.description || r.content || "",
        url: r.url || r.link || "",
      })),
    };
  }

  // Image generation
  if (parsed.url || parsed.imageUrl) {
    return {
      kind: "image",
      text: parsed.alt || "Generated image",
      imageUrl: parsed.url || parsed.imageUrl,
      imageAlt: parsed.alt || parsed.prompt || "",
    };
  }

  // Citation verdict
  if (parsed.verdict !== undefined) {
    const v = String(parsed.verdict).toLowerCase();
    return {
      kind: "verdict",
      text: `Verdict: ${v}`,
      verdict: {
        label: v === "supported" ? "Supported" : v === "refuted" ? "Refuted" : v === "partial" ? "Partial" : v,
        supported: v === "supported",
        partial: v === "partial" || v === "mixed",
      },
      confidence: parsed.confidence ?? parsed.score ?? 0,
    };
  }

  // Article lookup
  if (parsed.title && (parsed.blockCount !== undefined || parsed.blocks)) {
    return {
      kind: "article",
      text: parsed.title,
      articleTitle: parsed.title,
      articleSlug: parsed.slug || "",
      blockCount: parsed.blockCount ?? (Array.isArray(parsed.blocks) ? parsed.blocks.length : 0),
    };
  }

  // Content fetch (long text)
  if (parsed.content || (typeof str === "string" && str.length > 200 && !str.startsWith("{"))) {
    const content = parsed.content || str;
    return {
      kind: "fetch",
      text: content.slice(0, 150) + (content.length > 150 ? "..." : ""),
      contentPreview: content,
      url: parsed.url || "",
    };
  }

  // Map lookup
  if (parsed.lat !== undefined || parsed.coordinates || parsed.region) {
    return { kind: "map", text: parsed.region || parsed.title || `${parsed.lat}, ${parsed.lng}` };
  }

  // Task / sub-agent
  if (parsed.objective || parsed.task) {
    return { kind: "task", text: parsed.objective || parsed.task };
  }

  // Block render
  if (parsed.blockCount) return { kind: "generic", text: `${parsed.blockCount} blocks rendered` };
  if (parsed.queued) return { kind: "generic", text: `Queued: ${parsed.slug}` };

  return fallback;
}

function argsDisplay(name: string, args: Record<string, unknown>): string {
  if (name.includes("search")) return String(args.query ?? "");
  if (name === "webfetch") return String(args.url ?? "");
  if (name === "get_article" || name === "get_map") return String(args.slug ?? "");
  if (name === "generate_image") return String(args.prompt ?? "").slice(0, 100);
  if (name === "verify_citation") return String(args.claim ?? "").slice(0, 100);
  if (name === "article_search") return String(args.query ?? "");
  if (name === "task") return String(args.objective ?? args.task ?? "").slice(0, 100);
  if (name === "suggest_related") return String(args.slug ?? "");
  if (name === "mem_store") return `${args.key} = ${String(args.value ?? "").slice(0, 50)}`;
  if (name === "mem_recall") return String(args.key ?? "");
  if (name === "render_blocks") return `${(Array.isArray(args.blocks) ? args.blocks.length : 0)} blocks`;
  return JSON.stringify(args).slice(0, 120);
}

// ─── Rich result renderers ─────────────────────────────────────────

function SearchResults({ items }: { items: { title: string; snippet: string; url: string }[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="text-[10px] leading-relaxed px-2.5 py-2 rounded-lg cursor-pointer hover:bg-accent-bg/20 transition-colors" style={{ background: "color-mix(in srgb, var(--surface-elevated) 40%, transparent)" }}>
          <div className="flex items-start gap-1.5">
            <IconChevronRight size={8} style={{ color: "var(--subtle)", marginTop: 3, flexShrink: 0 }} />
            <div className="min-w-0">
              <div className="font-medium text-ink truncate">{item.title}</div>
              <div className="text-muted line-clamp-2 mt-0.5">{item.snippet}</div>
              {item.url && <div className="text-[8px] text-subtle truncate mt-0.5 font-mono">{item.url}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageResult({ url, alt, prompt }: { url: string; alt: string; prompt?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg overflow-hidden border border-border bg-surface-elevated/30">
        <div className="aspect-video relative flex items-center justify-center bg-surface-elevated/50">
          {!loaded && <Spinner size={20} />}
          <img
            src={url}
            alt={alt}
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
        {prompt && <div className="px-2 py-1.5 text-[9px] text-muted truncate border-t border-border">{prompt}</div>}
      </div>
    </div>
  );
}

function VerdictResult({ verdict, confidence }: { verdict: { label: string; supported: boolean; partial?: boolean }; confidence: number }) {
  const color = verdict.supported ? "var(--forest)" : verdict.partial ? "var(--gold)" : "var(--oxblood)";
  const bgColor = verdict.supported ? "var(--forest)" : verdict.partial ? "var(--gold)" : "var(--oxblood)";
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, " + bgColor + " 10%, transparent)" }}>
        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, " + bgColor + " 20%, transparent)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {verdict.supported ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
            {verdict.partial && <line x1="12" y1="6" x2="12" y2="18" />}
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color }}>{verdict.label}</span>
            <span className="text-[9px] text-muted">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, " + bgColor + " 15%, transparent)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${confidence * 100}%`, background: bgColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleResult({ title, slug, blockCount }: { title: string; slug?: string; blockCount?: number }) {
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--gold-bg) 30%, transparent)" }}>
        <IconBook size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-ink truncate">{title}</div>
          {blockCount !== undefined && <div className="text-[9px] text-muted">{blockCount} blocks</div>}
        </div>
        {slug && <span className="text-[9px] text-accent shrink-0">Open →</span>}
      </div>
    </div>
  );
}

function FetchResult({ url, content }: { url?: string; content?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-3 pb-3">
      {url && <div className="text-[9px] font-mono text-subtle truncate mb-1.5">{url}</div>}
      {content && (
        <>
          <div className={`text-[10px] text-muted leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>
            {content}
          </div>
          <button onClick={() => setExpanded((o) => !o)} className="text-[9px] text-accent hover:underline mt-1">
            {expanded ? "Show less" : "Read full page"}
          </button>
        </>
      )}
    </div>
  );
}

function GenericResult({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="px-3 pb-3">
      <div className="text-[10px] text-muted leading-relaxed">{text}</div>
    </div>
  );
}

// ─── Event entry ───────────────────────────────────────────────────

function EventEntry({ event, nextEvent }: { event: AgentEvent; nextEvent?: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isToolUse = event.type === "tool_use";
  const isToolResult = event.type === "tool_result";

  // Collapse tool_result into preceding tool_use
  if (isToolResult) return null;

  const data = event.data as Record<string, unknown>;

  if (isToolUse) {
    const name = (data.name as string) || "";
    const args = (data.args as Record<string, unknown>) || {};
    const hasResult = nextEvent?.type === "tool_result";
    const resultData = hasResult ? (nextEvent!.data as Record<string, unknown>) : null;
    const rawResult = resultData ? (resultData.result ?? resultData.content ?? "") : null;
    const rich = rawResult ? parseRichResult(name, rawResult) : null;

    return (
      <div className="border-b" style={{ borderColor: "var(--border)" }}>
        {/* Header row */}
        <button
          onClick={() => rich && setExpanded((o) => !o)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${rich ? "hover:bg-accent-bg/10 cursor-pointer" : "cursor-default"}`}
        >
          <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: toolColor(name) + "18", color: toolColor(name) }}>
            {toolIcon(name, 14)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-ink">{toolLabel(name)}</span>
              {!hasResult && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">{argsDisplay(name, args)}</div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[9px] text-subtle">{formatTime(event.timestamp)}</span>
            {rich && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-subtle transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>
        </button>

        {/* Result area */}
        {rich && expanded && (
          <div className="border-t" style={{ borderColor: "color-mix(in srgb, var(--border) 40%, transparent)" }}>
            {rich.kind === "search" && <SearchResults items={rich.items!} />}
            {rich.kind === "image" && <ImageResult url={rich.imageUrl!} alt={rich.imageAlt!} prompt={argsDisplay("generate_image", args)} />}
            {rich.kind === "verdict" && <VerdictResult verdict={rich.verdict!} confidence={rich.confidence!} />}
            {rich.kind === "article" && <ArticleResult title={rich.articleTitle!} slug={rich.articleSlug} blockCount={rich.blockCount} />}
            {rich.kind === "fetch" && <FetchResult url={rich.url} content={rich.contentPreview} />}
            {rich.kind === "generic" && <GenericResult text={rich.text} />}
          </div>
        )}
      </div>
    );
  }

  // Text / thinking
  if (event.type === "text") {
    const text = ((data.text ?? data.delta ?? "") as string);
    if (!text) return null;
    return (
      <div className="flex items-start gap-2 px-3 py-1.5">
        <span className="shrink-0 mt-0.5" style={{ color: "var(--muted)" }}><IconChat size={9} /></span>
        <span className="text-[10px] text-muted leading-relaxed">{text}</span>
      </div>
    );
  }

  // Status
  if (event.type === "status") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
        <span className="text-[10px] font-medium text-ink">{String(event.data)}</span>
      </div>
    );
  }

  // Error
  if (event.type === "error") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--oxblood) 10%, transparent)" }}>
        <IconX size={10} style={{ color: "var(--oxblood)", flexShrink: 0 }} />
        <span className="text-[10px]" style={{ color: "var(--oxblood)" }}>{String(event.data)}</span>
      </div>
    );
  }

  return null;
}

// ─── Main component ──────────────────────────────────────────────

export default function TruthConsole({ events, onClose, loading }: { events: AgentEvent[]; onClose?: () => void; loading?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <style>{`.tc-scroll::-webkit-scrollbar { width: 4px; } .tc-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--border) 40%, transparent); border-radius: 2px; } .tc-scroll::-webkit-scrollbar-track { background: transparent; }`}</style>

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <span className="text-xs font-medium text-ink">Agent</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full text-subtle" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }}>{events.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setAutoScroll(!autoScroll)} className="text-[9px] px-1.5 py-0.5 rounded transition-colors" style={{ color: autoScroll ? "var(--accent)" : "var(--subtle)" }}>Auto</button>
          {onClose && <button onClick={onClose} className="btn-ghost p-1" aria-label="Close"><IconX size={12} /></button>}
        </div>
      </div>

      {/* Event feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-1 space-y-1 tc-scroll">
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--subtle)", opacity: 0.4 }}>
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p className="text-[10px] text-subtle mt-2">Idle</p>
            <p className="text-[9px] text-subtle opacity-50 mt-0.5">Tool calls appear while the agent works</p>
          </div>
        )}
        {events.map((event, i) => (
          <EventEntry key={`${event.timestamp}-${i}`} event={event} nextEvent={events[i + 1]} />
        ))}
        {loading && events.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Spinner size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
