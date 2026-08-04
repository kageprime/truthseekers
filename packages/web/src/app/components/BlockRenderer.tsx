"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import MarkdownRenderer from "./MarkdownRenderer";
import MermaidDiagram from "./MermaidDiagram";
import { MediaImage, MediaLightbox } from "./MediaImage";
import { BASE } from "@/lib/constants";
import { IconLink, IconLightning } from "./Icons";
import { parseClaimAnchors } from "@/lib/claim-parser";
import { ProvenanceChipInline } from "./ProvenanceChip";

const InteractiveTimeline = dynamic(() => import("./InteractiveTimeline"), { ssr: false });
const MapViewer = dynamic(() => import("./MapViewer"), { ssr: false });
const ThreeDMapViewer = dynamic(() => import("./ThreeDMapViewer"), { ssr: false });

export { articleToBlocks } from "@encarta/core/dist/blocks.js";
import { useState } from "react";
import type {
  Block,
  HeadingBlockData,
  TextBlockData,
  SectionBlockData,
  TimelineBlockData,
  Map2DBlockData,
  Map3DBlockData,
  DiagramBlockData,
  ImageBlockData,
  VideoBlockData,
  GalleryBlockData,
  CitationBlockData,
  CrossrefBlockData,
  TableBlockData,
  ListBlockData,
} from "@encarta/core";

function normalizeBlockData(block: Block): Block {
  if (!block.data) return block;
  const d = block.data as Record<string, unknown>;

  if (block.type === "text" && typeof d.text === "string" && !d.content) {
    d.content = d.text; delete d.text;
  }
  if (block.type === "image" && typeof d.url === "string" && !d.src) {
    d.src = d.url; delete d.url;
  }
  if (block.type === "video" && typeof d.url === "string" && !d.src) {
    d.src = d.url; delete d.url;
  }
  if (block.type === "citation") {
    if (typeof d.text === "string" && !d.title) { d.title = d.text; delete d.text; }
    if (typeof d.source === "string" && !d.url) { d.url = d.source; delete d.source; }
  }
  if (block.type === "gallery" && Array.isArray(d.images)) {
    d.images = d.images.map((img: any) => {
      if (img && typeof img.url === "string" && !img.src) { img.src = img.url; }
      return img;
    });
  }
  if (block.type === "timeline" && Array.isArray(d.events)) {
    d.events = d.events.map((e: any) => {
      if (e && typeof e.year === "string") {
        const cleaned = e.year.replace(/[^0-9\-]/g, "");
        e.year = parseInt(cleaned, 10) || 0;
      }
      return e;
    });
  }
  return block;
}

export default function BlockRenderer({ blocks, compact = false }: { blocks: Block[]; compact?: boolean }) {
  if (!blocks || blocks.length === 0) {
    return <div className="text-sm" style={{ color: "var(--subtle)" }}>No content yet.</div>;
  }

  // Find index of the first text block — that one gets the drop cap.
  let firstTextIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (normalizeBlockData(blocks[i]).type === "text") { firstTextIdx = i; break; }
  }

  // Auto-number figures based on block position — deterministic for hydration.
  const figureTypes = new Set(["image", "video", "diagram", "gallery"]);

  return (
    <div className="block-renderer">
      {blocks.map((block, i) => {
        const figNum = blocks.slice(0, i).filter(b => figureTypes.has(normalizeBlockData(b).type)).length + 1;
        const hasFigType = figureTypes.has(normalizeBlockData(block).type);
        return (
          <BlockCard
            key={block.id ?? `block-${i}`}
            block={normalizeBlockData(block)}
            compact={compact}
            dropCap={i === firstTextIdx}
            figureNum={hasFigType ? figNum : undefined}
          />
        );
      })}
    </div>
  );
}

function BlockCard({ block, compact, dropCap, figureNum }: { block: Block; compact: boolean; dropCap?: boolean; figureNum?: number }) {
  switch (block.type) {
    case "heading":
      return <HeadingBlock data={block.data as unknown as HeadingBlockData} />;
    case "text":
      return <TextBlock data={block.data as unknown as TextBlockData} dropCap={dropCap} />;
    case "section":
      return <SectionBlock data={block.data as unknown as SectionBlockData} />;
    case "timeline":
      return <TimelineBlock data={block.data as unknown as TimelineBlockData} />;
    case "map_2d":
      return <Map2DBlock data={block.data as unknown as Map2DBlockData} />;
    case "map_3d":
      return <Map3DBlock data={block.data as unknown as Map3DBlockData} />;
    case "diagram":
      return <DiagramBlock data={block.data as unknown as DiagramBlockData} figureNum={figureNum} />;
    case "image":
      return <ImageBlock data={block.data as unknown as ImageBlockData} figureNum={figureNum} />;
    case "video":
      return <VideoBlock data={block.data as unknown as VideoBlockData} figureNum={figureNum} />;
    case "gallery":
      return <GalleryBlock data={block.data as unknown as GalleryBlockData} figureNum={figureNum} />;
    case "pullquote":
      return <PullQuoteBlock data={block.data as any} />;
    case "citation":
      return <CitationBlock data={block.data as unknown as CitationBlockData} />;
    case "crossref":
      return <CrossrefBlock data={block.data as unknown as CrossrefBlockData} />;
    case "table":
      return <TableBlock data={block.data as unknown as TableBlockData} />;
    case "list":
      return <ListBlock data={block.data as unknown as ListBlockData} />;
    case "tool_call":
      return <ToolCallBlock data={block.data as any} />;
    case "divider":
      return <DividerBlock />;
    default:
      return <UnknownBlock block={block} />;
  }
}

function TableBlock({ data }: { data: TableBlockData }) {
  if (!data?.headers && !data?.rows) return null;
  return (
    <div className="plate mb-4" style={{ overflowX: "auto" }}>
      {data.caption && <div className="small-caps p-2" style={{ color: "var(--gold)", borderBottom: "1px solid var(--rule)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>{data.caption}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        {data.headers && (
          <thead>
            <tr>
              {data.headers.map((h: string, i: number) => (
                <th key={i} style={{ padding: "0.5rem 0.75rem", borderBottom: "2px solid var(--gold)", background: "var(--surface-glass)", textAlign: "left", fontWeight: 600, fontSize: "0.75rem", color: "var(--ink)", letterSpacing: "0.03em" }}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {data.rows?.map((row: string[], i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "var(--gold-bg)" }}>
              {row.map((cell: string, j: number) => (
                <td key={j} style={{ padding: "0.45rem 0.75rem", borderBottom: "1px solid var(--rule)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.source && <div className="font-serif text-[10px] italic p-2" style={{ color: "var(--subtle)", borderTop: "1px solid var(--rule)" }}>Source: {data.source}</div>}
    </div>
  );
}

function ListBlock({ data }: { data: ListBlockData }) {
  if (!data?.items) return null;
  const Tag = data.style === "ordered" ? "ol" : "ul";
  return (
    <Tag style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", lineHeight: "1.7", color: "var(--ink)" }}>
      {data.items.map((item: string, i: number) => (
        <li key={i} style={{ margin: "0.15rem 0" }}>{item}</li>
      ))}
    </Tag>
  );
}

function HeadingBlock({ data }: { data: HeadingBlockData }) {
  if (!data) return null;
  const level = data.level ?? 3;
  const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
  const style: React.CSSProperties = level === 1
    ? { fontFamily: "var(--font-display)", fontSize: "1.85rem", fontWeight: 700, margin: "2.25rem 0 0.75rem", letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1.25 }
    : level === 2
    ? { fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700, margin: "1.75rem 0 0.5rem", paddingBottom: "0.4rem", borderBottom: "1px solid var(--gold)", color: "var(--ink)", letterSpacing: "-0.01em" }
    : { fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, margin: "1.4rem 0 0.5rem", color: "var(--ink)", fontStyle: "italic" };
  return <Tag style={style}>{data.text}</Tag>;
}

function TextBlock({ data, dropCap }: { data: TextBlockData; dropCap?: boolean }) {
  if (!data) return null;
  const content = (data as any).content || (data as any).text || "";
  if (!content.includes("[claim:")) {
    return (
      <div className={dropCap ? "drop-cap" : ""}>
        <MarkdownRenderer content={content} />
      </div>
    );
  }
  const { parts } = parseClaimAnchors(content);
  return (
    <div className={dropCap ? "drop-cap" : ""}>
      {parts.map((part, i) =>
        part.type === "claim" ? (
          <ProvenanceChipInline key={i} claimId={part.value} />
        ) : (
          <MarkdownRenderer key={i} content={part.value} />
        )
      )}
    </div>
  );
}

function SectionBlock({ data }: { data: SectionBlockData }) {
  if (!data) return null;
  return (
    <details className="plate p-3 mb-4">
      <summary className="font-display text-[0.95rem] cursor-pointer" style={{ color: "var(--ink)" }}>
        {data.title}
      </summary>
      {data.blocks && <div className="mt-3">{data.blocks.map((b, i) => <BlockCard key={b.id ?? `section-block-${i}`} block={b} compact={false} />)}</div>}
    </details>
  );
}

function TimelineBlock({ data }: { data: TimelineBlockData }) {
  if (!data?.events) return <div className="text-xs italic" style={{ color: "var(--subtle)" }}>No timeline events</div>;
  const events = data.events.map((e) => ({ ...e, year: typeof e.year === "string" ? parseInt(e.year, 10) || 0 : e.year }));
  return (
    <div className="plate p-3 mb-4 overflow-hidden">
      <InteractiveTimeline events={events} />
    </div>
  );
}

function Map2DBlock({ data }: { data: Map2DBlockData }) {
  if (!data) return null;
  return (
    <div className="plate p-3 mb-4 overflow-hidden" style={{ height: "clamp(250px, 50vh, 400px)" }}>
      <MapViewer markers={data.markers} layers={data.layers} centerLat={data.centerLat} centerLng={data.centerLng} zoom={data.zoom} />
    </div>
  );
}

function Map3DBlock({ data }: { data: Map3DBlockData }) {
  if (!data) return null;
  return (
    <div className="plate p-3 mb-4 overflow-hidden" style={{ height: "clamp(250px, 50vh, 400px)" }}>
      <ThreeDMapViewer scene={data as any} />
    </div>
  );
}

function DiagramBlock({ data, figureNum }: { data: DiagramBlockData; figureNum?: number }) {
  if (!data) return null;
  const num = figureNum;
  return (
    <figure className="figure-plate mb-4">
      <div className="p-2">
        <MermaidDiagram code={data.code} />
      </div>
      {(num != null || data.caption) && (
        <figcaption className="figure-caption">
          {num != null && <span className="figure-num">Fig. {num}</span>}
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}

function ImageBlock({ data, figureNum }: { data: ImageBlockData; figureNum?: number }) {
  if (!data) return null;
  const num = figureNum;
  return (
    <figure className="figure-plate mb-4">
      <MediaImage src={data.src} caption={undefined} prompt={data.prompt} />
      {(num != null || data.caption) && (
        <figcaption className="figure-caption">
          {num != null && <span className="figure-num">Fig. {num}</span>}
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}

function VideoBlock({ data, figureNum }: { data: VideoBlockData; figureNum?: number }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!data?.src) return <div className="text-xs italic" style={{ color: "var(--subtle)" }}>Video not available</div>;
  const videoSrc = data.src.startsWith("/") ? `${BASE}${data.src}` : data.src;
  const num = figureNum;
  return (
    <>
      <figure className="figure-plate mb-4 cursor-pointer" onClick={() => setLightboxOpen(true)}>
        <div className="relative">
          <video
            controls
            className="w-full"
            style={{ maxHeight: "480px" }}
            poster={data.poster}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>
        {(num != null || data.caption) && (
          <figcaption className="figure-caption">
            {num != null && <span className="figure-num">Fig. {num}</span>}
            {data.caption}
          </figcaption>
        )}
      </figure>
      {lightboxOpen && (
        <MediaLightbox src={data.src} caption={data.caption} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

function GalleryBlock({ data, figureNum }: { data: GalleryBlockData; figureNum?: number }) {
  if (!data?.images || data.images.length === 0) return null;
  const num = figureNum;
  return (
    <figure className="figure-plate mb-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
        {data.images.filter(Boolean).map((img, i) => (
          <div key={i} className="overflow-hidden" style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-sharp)", aspectRatio: "4/3" }}>
            <MediaImage src={img.src} caption={undefined} prompt={img.prompt} />
          </div>
        ))}
      </div>
      {(num != null || data.caption) && (
        <figcaption className="figure-caption">
          {num != null && <span className="figure-num">Plate {num}</span>}
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}

/** PullQuoteBlock — optional block the pipeline may emit. No-op if absent. */
function PullQuoteBlock({ data }: { data: { text?: string; quote?: string; cite?: string; attribution?: string } }) {
  const text = data?.text ?? data?.quote ?? "";
  if (!text) return null;
  return (
    <blockquote className="pull-quote">
      {text}
      {(data.cite || data.attribution) && (
        <footer className="dateline" style={{ marginTop: "0.75rem", fontSize: "0.7rem" }}>— {data.cite ?? data.attribution}</footer>
      )}
    </blockquote>
  );
}

function CitationBlock({ data }: { data: CitationBlockData }) {
  if (!data) return null;
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="plate flex items-start gap-2 mb-2 transition-colors"
      style={{ textDecoration: "none", color: "inherit", fontSize: "0.85rem", padding: "0.6rem 0.75rem", borderLeft: "2px solid var(--gold)" }}
    >
      <IconLink size={14} style={{ color: "var(--gold)", marginTop: 2 }} />
      <span className="flex-1 min-w-0">
        <span className="block truncate font-display" style={{ fontSize: "0.875rem" }}>{data.title || data.url}</span>
        {data.relevance && <span className="block font-serif text-xs italic" style={{ color: "var(--muted)" }}>{data.relevance}</span>}
      </span>
      <span className="text-[10px]" style={{ color: "var(--subtle)" }}>↗</span>
    </a>
  );
}

function CrossrefBlock({ data }: { data: CrossrefBlockData }) {
  if (!data?.slug) return null;
  return (
    <div className="see-also my-4">
      <span className="see-also-label">See also:</span>{" "}
      <Link href={`/article/${data.slug}`}>
        {data.title || data.slug.replace(/-/g, " ")}
      </Link>
      {data.relationship && <span className="font-serif italic text-xs" style={{ color: "var(--muted)" }}> — {data.relationship}</span>}
    </div>
  );
}

function ToolCallBlock({ data }: { data: { name: string; args?: Record<string, unknown>; result?: string } }) {
  if (!data) return null;
  return (
    <div className="flex items-start gap-2 text-xs py-1 px-2 mb-1" style={{ background: "var(--gold-bg)", borderRadius: "var(--radius-sharp)" }}>
      <IconLightning size={12} style={{ color: "var(--gold)", marginTop: 2 }} /> {data.name}
      {data.result && <code className="text-[10px]" style={{ color: "var(--muted)" }}>{data.result.slice(0, 150)}</code>}
    </div>
  );
}

function DividerBlock() {
  return (
    <div className="fleuron" aria-hidden="true">❦</div>
  );
}

function UnknownBlock({ block }: { block: Block }) {
  const text = typeof block.data === "object" && block.data !== null
    ? ((block.data as Record<string, unknown>).content as string) || ((block.data as Record<string, unknown>).text as string) || ""
    : "";
  if (!text) return null;
  return (
    <div className="text-base leading-relaxed text-ink">
      <MarkdownRenderer content={text} />
    </div>
  );
}
