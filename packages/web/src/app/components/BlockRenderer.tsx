"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import MarkdownRenderer from "./MarkdownRenderer";
import MermaidDiagram from "./MermaidDiagram";
import { MediaImage } from "./MediaImage";
import { BASE } from "@/lib/constants";
import { IconLink, IconLightning } from "./Icons";

const InteractiveTimeline = dynamic(() => import("./InteractiveTimeline"), { ssr: false });
const MapViewer = dynamic(() => import("./MapViewer"), { ssr: false });
const ThreeDMapViewer = dynamic(() => import("./ThreeDMapViewer"), { ssr: false });

export { articleToBlocks } from "@encarta/core";
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

  return (
    <div className="block-renderer">
      {blocks.map((block, i) => (
        <BlockCard key={block.id ?? `block-${i}`} block={normalizeBlockData(block)} compact={compact} />
      ))}
    </div>
  );
}

function BlockCard({ block, compact }: { block: Block; compact: boolean }) {
  switch (block.type) {
    case "heading":
      return <HeadingBlock data={block.data as unknown as HeadingBlockData} />;
    case "text":
      return <TextBlock data={block.data as unknown as TextBlockData} />;
    case "section":
      return <SectionBlock data={block.data as unknown as SectionBlockData} />;
    case "timeline":
      return <TimelineBlock data={block.data as unknown as TimelineBlockData} />;
    case "map_2d":
      return <Map2DBlock data={block.data as unknown as Map2DBlockData} />;
    case "map_3d":
      return <Map3DBlock data={block.data as unknown as Map3DBlockData} />;
    case "diagram":
      return <DiagramBlock data={block.data as unknown as DiagramBlockData} />;
    case "image":
      return <ImageBlock data={block.data as unknown as ImageBlockData} />;
    case "video":
      return <VideoBlock data={block.data as unknown as VideoBlockData} />;
    case "gallery":
      return <GalleryBlock data={block.data as unknown as GalleryBlockData} />;
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
    <div style={{ overflowX: "auto", margin: "1rem 0", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
      {data.caption && <div className="text-xs font-semibold p-2" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>{data.caption}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        {data.headers && (
          <thead>
            <tr>
              {data.headers.map((h: string, i: number) => (
                <th key={i} style={{ padding: "0.5rem 0.75rem", borderBottom: "2px solid var(--border)", background: "var(--surface-glass)", textAlign: "left", fontWeight: 600, fontSize: "0.8rem", color: "var(--ink)" }}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {data.rows?.map((row: string[], i: number) => (
            <tr key={i}>
              {row.map((cell: string, j: number) => (
                <td key={j} style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--ink)" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
    ? { fontFamily: "'Press Start 2P', monospace", fontSize: "1rem", margin: "1.5rem 0 0.75rem", wordBreak: "break-word" }
    : level === 2
    ? { fontFamily: "'Press Start 2P', monospace", fontSize: "0.8rem", margin: "1.25rem 0 0.5rem", paddingBottom: "0.5rem", borderBottom: "3px solid var(--ink)" }
    : { fontFamily: "'Press Start 2P', monospace", fontSize: "0.7rem", margin: "1rem 0 0.5rem" };
  return <Tag style={style}>{data.text}</Tag>;
}

function TextBlock({ data }: { data: TextBlockData }) {
  if (!data) return null;
  return <MarkdownRenderer content={data.content} />;
}

function SectionBlock({ data }: { data: SectionBlockData }) {
  if (!data) return null;
  return (
    <details className="glass-card-static p-3 mb-3" style={{ border: "2px solid var(--ink)" }}>
      <summary className="font-bold text-sm cursor-pointer" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
        {data.title}
      </summary>
      {data.blocks && <div className="mt-3">{data.blocks.map((b, i) => <BlockCard key={b.id ?? `section-block-${i}`} block={b} compact={false} />)}</div>}
    </details>
  );
}

function TimelineBlock({ data }: { data: TimelineBlockData }) {
  if (!data?.events) return <div className="text-xs" style={{ color: "var(--subtle)" }}>No timeline events</div>;
  const events = data.events.map((e) => ({ ...e, year: typeof e.year === "string" ? parseInt(e.year, 10) || 0 : e.year }));
  return (
    <div className="glass-card-static p-3 mb-3 overflow-hidden">
      <InteractiveTimeline events={events} />
    </div>
  );
}

function Map2DBlock({ data }: { data: Map2DBlockData }) {
  if (!data) return null;
  return (
    <div className="glass-card-static p-3 mb-3 overflow-hidden" style={{ height: "clamp(250px, 50vh, 400px)" }}>
      <MapViewer markers={data.markers} layers={data.layers} centerLat={data.centerLat} centerLng={data.centerLng} zoom={data.zoom} />
    </div>
  );
}

function Map3DBlock({ data }: { data: Map3DBlockData }) {
  if (!data) return null;
  return (
    <div className="glass-card-static p-3 mb-3 overflow-hidden" style={{ height: "clamp(250px, 50vh, 400px)" }}>
      <ThreeDMapViewer scene={data as any} />
    </div>
  );
}

function DiagramBlock({ data }: { data: DiagramBlockData }) {
  if (!data) return null;
  return (
    <div className="glass-card-static p-3 mb-3">
      {data.caption && <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>{data.caption}</div>}
      <MermaidDiagram code={data.code} />
    </div>
  );
}

function ImageBlock({ data }: { data: ImageBlockData }) {
  if (!data) return null;
  return (
    <div className="mb-3">
      <MediaImage src={data.src} caption={data.caption} prompt={data.prompt} />
    </div>
  );
}

function VideoBlock({ data }: { data: VideoBlockData }) {
  if (!data?.src) return <div className="text-xs" style={{ color: "var(--subtle)" }}>Video not available</div>;
  const videoSrc = data.src.startsWith("/") ? `${BASE}${data.src}` : data.src;
  return (
    <div className="glass-card-static p-2 mb-3">
      {data.caption && <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>{data.caption}</div>}
      <video
        controls
        className="w-full"
        style={{ maxHeight: "480px", border: "2px solid var(--ink)" }}
        poster={data.poster}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
    </div>
  );
}

function GalleryBlock({ data }: { data: GalleryBlockData }) {
  if (!data?.images || data.images.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
      {data.images.filter(Boolean).map((img, i) => (
        <MediaImage key={i} src={img.src} caption={img.caption} prompt={img.prompt} />
      ))}
    </div>
  );
}

function CitationBlock({ data }: { data: CitationBlockData }) {
  if (!data) return null;
  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      className="glass-card-static p-2 flex items-center gap-2 mb-2"
      style={{ textDecoration: "none", color: "inherit", fontSize: "0.85rem" }}
    >
      <IconLink size={16} />
      <span className="flex-1 min-w-0">
        <span className="block truncate font-semibold">{data.title || data.url}</span>
        {data.relevance && <span className="block text-xs" style={{ color: "var(--muted)" }}>{data.relevance}</span>}
      </span>
    </a>
  );
}

function CrossrefBlock({ data }: { data: CrossrefBlockData }) {
  if (!data) return null;
  return (
    <Link href={`/article/${data.slug}`}
      className="glass-card-static p-2 flex items-center gap-2 mb-2"
      style={{ textDecoration: "none", color: "inherit", fontSize: "0.85rem" }}
     
    >
      <IconLink size={16} />
      <span className="flex-1 min-w-0">
        <span className="block truncate font-semibold">{data.title || data.slug}</span>
        {data.relationship && <span className="block text-xs" style={{ color: "var(--muted)" }}>{data.relationship}</span>}
      </span>
      <span style={{ color: "var(--accent)", fontSize: "1.2rem" }}>→</span>
    </Link>
  );
}

function ToolCallBlock({ data }: { data: { name: string; args?: Record<string, unknown>; result?: string } }) {
  if (!data) return null;
  return (
    <div className="flex items-start gap-2 text-xs py-1 px-2 rounded mb-1" style={{ background: "#f0f7ff" }}>
      <IconLightning size={12} /> {data.name}
      {data.result && <code className="text-[10px]" style={{ color: "var(--muted)" }}>{data.result.slice(0, 150)}</code>}
    </div>
  );
}

function DividerBlock() {
  return <hr style={{ border: "none", borderTop: "2px solid var(--ink)", margin: "1.5rem 0" }} />;
}

function UnknownBlock({ block }: { block: Block }) {
  return (
    <div className="text-xs p-2 mb-1 border border-dashed border-[var(--border)]" style={{ color: "var(--subtle)" }}>
      Unknown block type: {block.type}
    </div>
  );
}
