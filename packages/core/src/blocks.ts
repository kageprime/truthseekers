import type {
  Block,
  HeadingBlockData,
  TextBlockData,
  ImageBlockData,
  VideoBlockData,
  DiagramBlockData,
  TimelineBlockData,
  CitationBlockData,
  CrossrefBlockData,
} from "./types.js";

interface SectionLike {
  id?: string;
  title: string;
  content: string;
  media?: Array<{
    type: string;
    id?: string;
    caption?: string;
    src?: string;
    code?: string;
    prompt?: string;
    source?: string;
  }>;
}

interface TimelineLike {
  id?: string;
  year: number;
  event: string;
  description: string;
  category?: string;
  image?: string;
  causes?: string[];
}

interface CrossrefLike {
  id: string;
  title: string;
  relationship?: string;
}

interface CitationLike {
  url: string;
  title: string;
  relevance?: string;
}

export function articleToBlocks(
  slug: string,
  title: string,
  abstract: string,
  sections: SectionLike[],
  timeline: TimelineLike[],
  crossrefs: CrossrefLike[],
  citations: CitationLike[],
): Block[] {
  const blocks: Block[] = [];
  let id = 0;
  const idGen = () => `b-${slug}-${id++}`;

  if (title) {
    blocks.push({ id: idGen(), type: "heading", data: { level: 1, text: title } satisfies HeadingBlockData });
  }

  if (abstract) {
    blocks.push({ id: idGen(), type: "text", data: { content: abstract } satisfies TextBlockData });
  }

  for (const sec of sections || []) {
    blocks.push({
      id: idGen(),
      type: "heading",
      data: { level: 2, text: sec.title || "" } satisfies HeadingBlockData,
      meta: { sectionId: sec.id },
    });
    if (sec.content) {
      blocks.push({ id: idGen(), type: "text", data: { content: sec.content } satisfies TextBlockData, meta: { sectionId: sec.id } });
    }
    for (const media of sec.media || []) {
      if (media.type === "image" && media.src) {
        blocks.push({ id: idGen(), type: "image", data: { src: media.src, caption: media.caption, prompt: media.prompt, source: media.source } satisfies ImageBlockData, meta: { sectionId: sec.id } });
      }
      if (media.type === "diagram" && media.code) {
        blocks.push({ id: idGen(), type: "diagram", data: { code: media.code, caption: media.caption } satisfies DiagramBlockData, meta: { sectionId: sec.id } });
      }
      if (media.type === "video" && media.src) {
        blocks.push({ id: idGen(), type: "video", data: { src: media.src, caption: media.caption, prompt: media.prompt } satisfies VideoBlockData, meta: { sectionId: sec.id } });
      }
    }
  }

  if (timeline && timeline.length > 0) {
    blocks.push({ id: idGen(), type: "heading", data: { level: 2, text: "Timeline" } satisfies HeadingBlockData });
    blocks.push({ id: idGen(), type: "timeline", data: { events: timeline } satisfies TimelineBlockData });
  }

  if (citations && citations.length > 0) {
    blocks.push({ id: idGen(), type: "heading", data: { level: 2, text: "Citations" } satisfies HeadingBlockData });
    for (const c of citations) {
      blocks.push({ id: idGen(), type: "citation", data: { url: c.url, title: c.title, relevance: c.relevance } satisfies CitationBlockData });
    }
  }

  if (crossrefs && crossrefs.length > 0) {
    blocks.push({ id: idGen(), type: "heading", data: { level: 2, text: "Related Articles" } satisfies HeadingBlockData });
    for (const cr of crossrefs) {
      blocks.push({ id: idGen(), type: "crossref", data: { slug: cr.id, title: cr.title, relationship: cr.relationship } satisfies CrossrefBlockData });
    }
  }

  return blocks;
}

/**
 * Stable, content-only signature for a block.
 *
 * Ignores the volatile `id` (e.g. `rb-{Date.now()}-{n}` from render_blocks)
 * so that semantically identical blocks emitted by repeated tool calls
 * collapse to a single signature. Object keys are sorted so that key order
 * does not defeat dedup.
 */
export function blockSignature(block: Block): string {
  const { id: _id, ...rest } = block;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

/**
 * Deduplicate an array of blocks by content signature, preserving the first
 * occurrence of each distinct block. Safe for blocks of the same type with
 * different content — only exact content duplicates are dropped.
 */
export function dedupeBlocks(blocks: Block[] | undefined | null): Block[] {
  if (!blocks || blocks.length === 0) return [];
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const b of blocks) {
    const sig = blockSignature(b);
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(b);
    }
  }
  return out;
}
