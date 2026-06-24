/**
 * Some chat models (notably Gemma/DeepSeek-derived) emit render_blocks content
 * as raw inline DSML markup instead of using the OpenAI tool-calling protocol:
 *
 *   <render_blocks> <｜DSML｜parameter name="blocks" string="false">[...]</｜DSML｜parameter> </｜tool_calls｜>
 *
 * The backend attempts to extract blocks from this in buildResult(), but stored
 * messages and in-flight streamed tokens can still contain the raw markup.
 * These helpers strip it from content and pull out any blocks so they render
 * as structured content instead of leaking as literal text.
 */

import type { Block } from "@encarta/core";

// Regexes use the unicode pipe char ｜ (U+FF5C) the model emits, not ASCII |.
// Matching is case-insensitive and dotall ([\s\S]) so multi-line JSON works.
const DSML_PARAM_RE = /<｜DSML｜parameter[^>]*>([\s\S]*?)<\/｜DSML｜parameter>/gi;
const RENDER_BLOCKS_RE = /<render_blocks>([\s\S]*?)<\/render_blocks>/gi;
// Final sweep: ANY tag containing the ｜ char, opening OR closing (the <\/?
// makes it match </｜...> too — the original bug only matched <｜...> and left
// every closing tag like </｜DSML｜tool_calls> in the text).
const ANY_DSML_TAG_RE = /<\/?｜[^>]*>/g;
// Orphaned render_blocks tags (opening or closing) without a matching partner.
const RENDER_TAGS_RE = /<\/?render_blocks\s*>/gi;
// A bare JSON array of objects: the model sometimes dumps the blocks payload
// as raw JSON with no wrapper tags at all (a failed tool-call emission).
const BARE_ARRAY_RE = /\[\s*\{[\s\S]*?\}\s*\]/g;

const KNOWN_BLOCK_TYPES = new Set([
  "heading", "text", "section", "timeline", "image", "video",
  "gallery", "citation", "crossref", "diagram", "divider",
  "map_2d", "map_3d", "table", "list", "pullquote", "tool_call",
]);

let blockCounter = 0;
function makeId(): string {
  return `dsml-${Date.now().toString(36)}-${(blockCounter++).toString(36)}`;
}

function parseBlocksFromText(text: string): Block[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  const jsonStr = text.slice(start, end + 1);
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const blocks: Block[] = [];
  for (const rb of raw) {
    if (!rb || typeof rb !== "object" || typeof (rb as any).type !== "string") continue;
    blocks.push({ id: makeId(), type: (rb as any).type, data: (rb as any).data ?? {} });
  }
  return blocks;
}

// Confirms a JSON array string is genuinely a blocks payload: parses, every
// element has a known `type`, and element count matches. Prevents stripping
// arbitrary JSON arrays (e.g. ["a","b"]).
function looksLikeBlocksArray(jsonStr: string, parsedCount: number): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    return false;
  }
  if (!Array.isArray(raw) || raw.length !== parsedCount || raw.length === 0) return false;
  return raw.every(
    (el) => el && typeof el === "object" && KNOWN_BLOCK_TYPES.has((el as any).type),
  );
}

// Finds bare JSON block arrays (no wrapper tags) and removes them from text,
// returning the extracted blocks.
function stripBareBlockArrays(text: string): { content: string; blocks: Block[] } {
  const blocks: Block[] = [];
  let cleaned = text;
  // Loop: a single pass may not catch all arrays because indices shift after
  // a removal. Stop as soon as we hit a non-block array so we don't strip
  // unrelated JSON (e.g. an inline table embedded in prose).
  while (true) {
    const fresh = new RegExp(BARE_ARRAY_RE.source, "g");
    const match = fresh.exec(cleaned);
    if (!match) break;
    const candidate = match[0];
    const parsed = parseBlocksFromText(candidate);
    if (!looksLikeBlocksArray(candidate, parsed.length)) break;
    blocks.push(...parsed);
    cleaned = cleaned.slice(0, match.index) + cleaned.slice(match.index + candidate.length);
  }
  return { content: cleaned, blocks };
}

/**
 * Extract structured blocks from any DSML/render_blocks markup embedded in the
 * content, and return the content with that markup stripped out.
 */
export function extractInlineBlocks(content: string): { content: string; blocks: Block[] } {
  if (!content || !content.includes("[")) return { content, blocks: [] };
  const blocks: Block[] = [];

  // Pull blocks from DSML parameter regions and paired render_blocks, then
  // REMOVE the whole region so the bare-array scan doesn't double-extract.
  for (const re of [DSML_PARAM_RE, RENDER_BLOCKS_RE]) {
    const fresh = new RegExp(re.source, re.flags);
    for (const m of content.matchAll(fresh)) {
      blocks.push(...parseBlocksFromText((m[1] ?? "").trim()));
    }
  }

  let cleaned = content
    .replace(DSML_PARAM_RE, "")
    .replace(RENDER_BLOCKS_RE, "")
    .replace(ANY_DSML_TAG_RE, "")
    .replace(RENDER_TAGS_RE, "");

  // Bare JSON block arrays: no wrapper tags, just a raw blocks payload.
  const bare = stripBareBlockArrays(cleaned);
  cleaned = bare.content;
  blocks.push(...bare.blocks);

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return { content: cleaned, blocks };
}

/**
 * Merge a message's existing blocks with any blocks that were actually inline
 * in its content as DSML markup, and return sanitized content. Dedupes by
 * type+data signature.
 */
export function sanitizeMessage(content: string, existingBlocks?: Block[] | null): { content: string; blocks: Block[] } {
  const { content: cleaned, blocks: inline } = extractInlineBlocks(content);
  const merged: Block[] = [];
  const seen = new Set<string>();
  const push = (b?: Block | null) => {
    if (!b || typeof b.type !== "string") return;
    const sig = b.type + ":" + JSON.stringify(b.data ?? {}).slice(0, 200);
    if (seen.has(sig)) return;
    seen.add(sig);
    merged.push(b);
  };
  if (Array.isArray(existingBlocks)) {
    for (const b of existingBlocks) push(sanitizeBlock(b));
  }
  for (const b of inline) push(b);
  return { content: cleaned, blocks: merged };
}

// coerce loosely-typed incoming blocks into the Block shape the renderer expects
function sanitizeBlock(b: any): Block {
  return {
    id: typeof b?.id === "string" ? b.id : makeId(),
    type: typeof b?.type === "string" ? b.type : "text",
    data: b?.data ?? {},
  };
}
