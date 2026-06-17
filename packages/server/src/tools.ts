import { dbReady } from "./shared.js";
import { PUBLIC_URL } from "./shared.js";
import { getArticle, searchArticles, getGraphEdges, getBacklinks, memStore, memRecall } from "@encarta/storage";
import { articleToBlocks, sendPromptStream, CHAT_TOOL_DEFINITIONS, BUILT_IN_TOOL_EXECUTORS } from "@encarta/core";
import type { ToolExecutor } from "@encarta/core";
import { generateImage, generateVideo } from "./imageGen.js";

export function createToolExecutors(
  queue: any,
  selectedModel?: string,
): Record<string, ToolExecutor> {
  return {
    ...BUILT_IN_TOOL_EXECUTORS,
    get_article: async (a) => {
      if (!dbReady) return { result: "Database unavailable — article lookup skipped" };
      const article = await getArticle(a.slug);
      if (!article) return { result: "Article not found" };
      const articleBlocks = article.blocks || articleToBlocks(
        article.slug, article.title, article.abstract,
        article.sections, article.timeline, article.crossrefs, article.citations,
      );
      return {
        result: JSON.stringify({ title: article.title, abstract: article.abstract, slug: article.slug, blockCount: articleBlocks.length }),
        blocks: articleBlocks,
      };
    },
    create_article: async (a) => {
      queue.enqueue(a.slug, { persona: "veritas" });
      return { result: JSON.stringify({ queued: true, slug: a.slug }) };
    },
    article_search: async (a) => {
      if (!dbReady) return { result: "Database unavailable — article search skipped" };
      const results = await searchArticles(a.query, a.maxResults || 5);
      if (results.length === 0) return { result: "No articles found" };
      return { result: JSON.stringify(results.map((r: any) => ({ slug: r.slug, title: r.title, abstract: r.abstract?.slice(0, 300) }))) };
    },
    get_map: async (a) => {
      if (!dbReady) return { result: "Database unavailable — map lookup skipped" };
      const { getMap } = await import("@encarta/storage");
      const map = await getMap(a.slug);
      if (!map) return { result: "Map not found" };
      return {
        result: JSON.stringify({ slug: map.slug, title: map.title, markerCount: map.markers?.length || 0, has3D: !!map.threedScene }),
        blocks: map.markers ? [{ type: "map_2d", data: { markers: map.markers, centerLat: map.centerLat, centerLng: map.centerLng, zoom: map.zoom } }] : undefined,
      };
    },
    generate_image: async (a) => {
      const r = await generateImage(a.prompt, { id: `chat-${Date.now()}`, caption: a.caption || "" });
      if (!r) return { result: "Image generation failed" };
      const src = r.url.startsWith("/") && PUBLIC_URL ? `${PUBLIC_URL}${r.url}` : r.url;
      return { result: JSON.stringify({ url: src, caption: r.caption }), blocks: [{ type: "image", data: { src, caption: r.caption } }] };
    },
    generate_video: async (a) => {
      const r = await generateVideo(a.prompt, { id: `chat-${Date.now()}`, caption: a.caption || "" });
      if (!r) return { result: "Video generation failed" };
      const src = r.url.startsWith("/") && PUBLIC_URL ? `${PUBLIC_URL}${r.url}` : r.url;
      return { result: JSON.stringify({ url: src, caption: r.caption }), blocks: [{ type: "video", data: { src, caption: r.caption } }] };
    },
    suggest_related: async (a) => {
      if (!dbReady) return { result: "Database unavailable — related articles skipped" };
      const [edges, backlinks] = await Promise.all([getGraphEdges(a.slug), getBacklinks(a.slug)]);
      if (edges.length === 0 && backlinks.length === 0) return { result: "No related articles found" };
      return { result: JSON.stringify({ outgoing: edges, incoming: backlinks }) };
    },
    task: async (a) => {
      const subTools = Array.isArray(a.tools) && a.tools.length > 0
        ? CHAT_TOOL_DEFINITIONS.filter((t) => a.tools.includes(t.function.name))
        : CHAT_TOOL_DEFINITIONS.filter((t) => t.function.name === "web_search" || t.function.name === "webfetch");
      const subResult = await sendPromptStream(
        [{ role: "user" as const, content: a.objective }],
        undefined,
        { system: "You are a research sub-agent.", tools: subTools, temperature: 0.5, maxTokens: 4096, model: selectedModel },
      );
      return { result: subResult.text || "Sub-agent completed with no output." };
    },
    mem_store: async (a) => { await memStore(a.key, a.value); return { result: `Stored "${a.key}"` }; },
    mem_recall: async (a) => { const v = await memRecall(a.key); return { result: v ?? `No stored value for "${a.key}"` }; },
  };
}

export { dbReady } from "./shared.js";

export async function loadSessionContext(): Promise<string> {
  try {
    const { memRecallAll } = await import("@encarta/storage");
    const allMemories = await memRecallAll();
    if (allMemories.length > 0) {
      return "\n\n## User Preferences\n" + allMemories.map((m: any) => `${m.key}: ${m.value}`).join("\n");
    }
  } catch {}
  return "";
}
