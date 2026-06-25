import {
  IconSearch, IconGlobe, IconBook, IconMap, IconImage, IconCheck,
  IconLink, IconPlus, IconDatabase, IconLightning, IconChat,
} from "../Icons";

// ─── Icon / label / color registry ────────────────────────────────
// Extracted verbatim from TruthConsole so the deck + console share one source.

export const TOOL_ICONS: Record<string, (size?: number) => React.ReactNode> = {
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

export const TOOL_COLORS: Record<string, string> = {
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

export function toolIcon(name: string, size?: number): React.ReactNode {
  return TOOL_ICONS[name]?.(size) ?? <IconLightning size={size ?? 14} />;
}

export function toolLabel(name: string): string {
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

export function toolColor(name: string): string {
  return TOOL_COLORS[name] ?? "var(--accent)";
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── args preview + rich-result parsing (verbatim from TruthConsole) ────

export function argsDisplay(name: string, args: Record<string, unknown>): string {
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

export interface RichResult {
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

export function parseRichResult(name: string, raw: unknown): RichResult {
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
