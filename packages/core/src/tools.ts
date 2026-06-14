import { tavilySearch, sendPrompt } from "./agent.js";
import type { ToolDefinition } from "./agent.js";

export type ToolExecutor = (args: any) => Promise<{ result: string; blocks?: any[] }>;

export const CHAT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information on a topic",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_blocks",
      description: "Render structured content blocks in the conversation. Use this for ALL rich content: timelines, maps (2D/3D), image galleries, citation lists, cross-references, diagrams (mermaid), headings, text, and dividers. Always call this tool to present structured data — do NOT format it as plain text.",
      parameters: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            description: "Array of block objects to render. You can include multiple blocks of different types in a single call.",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["heading", "text", "timeline", "image", "gallery", "citation", "crossref", "diagram", "divider", "map_2d", "map_3d"],
                  description: "Block type. Use 'timeline' for any chronological/historical data with year/event/description entries. Use 'map_2d' or 'map_3d' for any geographic/location data with markers.",
                },
                data: { type: "object", description: "Block data. For 'timeline': { events: [{ year: number | string, event: string, description: string }] }. For 'map_2d'/'map_3d': { markers: [{ lat: number, lng: number, title: string, description?: string, type?: string }], centerLat?: number, centerLng?: number, zoom?: number }. For 'heading': { text: string, level?: number }. For 'text': { content: string }. For 'diagram': { code: string, caption?: string }. For 'citation': { source: string, url?: string, text: string }. For 'crossref': { slug: string, title: string, abstract?: string }. For 'gallery': { images: Array<{ src: string, alt: string, caption?: string }> }. For 'divider': {}." },
              },
              required: ["type", "data"],
            },
          },
        },
        required: ["blocks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_article",
      description: "Look up an existing encyclopedia article by slug",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Article slug" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_article",
      description: "Generate a full encyclopedia article for a topic. This runs the entire pipeline (research, write, verify, etc.) and stores the result.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Topic slug (lowercase, hyphenated)" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "webfetch",
      description: "Fetch the content of a specific URL and return its text. Use this when you need the full content of a page you found via web_search, rather than just the search snippet.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "article_search",
      description: "Search the encyclopedia's existing knowledge base for articles matching a query. Use this before generating new content — there may already be an article on the topic.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_map",
      description: "Look up an existing map by slug or search by region/era. Returns full map data including markers, center coordinates, timeline events, and 3D scene if available.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Map slug (e.g. 'map-of-ancient-rome')" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image using AI. Use this when you need a custom illustration, diagram, or visual for the current topic. Returns a URL to the generated image.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed image generation prompt. Include style, subject, composition, and mood." },
          caption: { type: "string", description: "Optional short caption for the image" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_citation",
      description: "Verify a claim against a source URL. Fetches the source, extracts the relevant content, and checks whether the claim is supported. Returns a confidence score and explanation.",
      parameters: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The claim or statement to verify" },
          sourceUrl: { type: "string", description: "The URL of the source to check against" },
        },
        required: ["claim", "sourceUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_related",
      description: "Find articles and topics related to a given slug. Returns cross-references, backlinks, and their relationships.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Article slug to find related topics for" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task",
      description: "Delegate a sub-task to a sub-agent. Use this for work that can be done in parallel (e.g. researching multiple topics simultaneously). The sub-agent will run with a limited set of research tools.",
      parameters: {
        type: "object",
        properties: {
          objective: { type: "string", description: "What the sub-agent should accomplish" },
          tools: { type: "array", items: { type: "string" }, description: "Tools the sub-agent may use (e.g. ['web_search', 'webfetch'])" },
        },
        required: ["objective"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mem_store",
      description: "Store a piece of information about the user for future conversations. Use this to remember preferences, facts, or context the user has shared.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'user_location', 'topic_interest')" },
          value: { type: "string", description: "The value to remember" },
        },
        required: ["key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mem_recall",
      description: "Retrieve stored information about the user from previous conversations. Use this to recall preferences, facts, or context.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key to look up (e.g. 'user_location')" },
        },
        required: ["key"],
      },
    },
  },
];

export const BUILT_IN_TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  web_search: async (args) => {
    const results = await tavilySearch(args.query, args.maxResults || 5);
    return {
      result: JSON.stringify(results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet.slice(0, 500),
      }))),
    };
  },
  render_blocks: async (args) => {
    const incoming = Array.isArray(args.blocks) ? args.blocks : [];
    return {
      result: JSON.stringify({ blockCount: incoming.length }),
      blocks: incoming.length > 0 ? incoming : undefined,
    };
  },
  webfetch: async (args) => {
    const res = await fetch(args.url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Truthseekers/1.0 (encyclopedia agent)" },
    });
    if (!res.ok) return { result: `HTTP ${res.status}: ${res.statusText}` };
    const text = await res.text();
    const stripped = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return { result: stripped.slice(0, 8000) };
  },
  verify_citation: async (args) => {
    const fetchRes = await fetch(args.sourceUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Truthseekers/1.0 (encyclopedia agent)" },
    });
    if (!fetchRes.ok) return { result: JSON.stringify({ supported: false, confidence: 0, explanation: `Failed to fetch source: HTTP ${fetchRes.status}` }) };
    const html = await fetchRes.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    if (!text) return { result: JSON.stringify({ supported: false, confidence: 0, explanation: "No readable text extracted from source" }) };
    const verdict = await sendPrompt([
      { role: "system", content: "You are a fact-checking AI. Given a claim and source text, determine if the source supports the claim. Respond with JSON only: { supported: boolean, confidence: number (0-1), explanation: string }" },
      { role: "user", content: `Claim: "${args.claim}"\n\nSource text:\n${text}` },
    ], { temperature: 0.3, maxTokens: 500 });
    return { result: verdict.text };
  },
};
