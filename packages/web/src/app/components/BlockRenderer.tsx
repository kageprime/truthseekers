"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import MarkdownRenderer from "./MarkdownRenderer";
import MermaidDiagram from "./MermaidDiagram";
import { MediaImage } from "./MediaImage";
import { BASE } from "@/lib/api";

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
} from "@encarta/core";

export default function BlockRenderer({ blocks, compact = false }: { blocks: Block[]; compact?: boolean }) {
  if (!blocks || blocks.length === 0) {
    return <div className="text-sm" style={{ color: "var(--subtle)" }}>No content yet.</div>;
  }

  return (
    <div className="block-renderer">
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} compact={compact} />
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
    case "tool_call":
      return <ToolCallBlock data={block.data as any} />;
    case "divider":
      return <DividerBlock />;
    default:
      return <UnknownBlock block={block} />;
  }
}

function HeadingBlock({ data }: { data: HeadingBlockData }) {
  const Tag = data.level === 1 ? "h1" : data.level === 2 ? "h2" : "h3";
  const style: React.CSSProperties = data.level === 1
    ? { fontFamily: "'Press Start 2P', monospace", fontSize: "1rem", margin: "1.5rem 0 0.75rem", wordBreak: "break-word" }
    : data.level === 2
    ? { fontFamily: "'Press Start 2P', monospace", fontSize: "0.8rem", margin: "1.25rem 0 0.5rem", paddingBottom: "0.5rem", borderBottom: "3px solid var(--ink)" }
    : { fontFamily: "'Press Start 2P', monospace", fontSize: "0.7rem", margin: "1rem 0 0.5rem" };
  return <Tag style={style}>{data.text}</Tag>;
}

function TextBlock({ data }: { data: TextBlockData }) {
  return <MarkdownRenderer content={data.content} />;
}

function SectionBlock({ data }: { data: SectionBlockData }) {
  return (
    <details className="pixel-card-sm p-3 mb-3 bg-white" style={{ border: "2px solid var(--ink)" }}>
      <summary className="font-bold text-sm cursor-pointer" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
        {data.title}
      </summary>
      {data.blocks && <div className="mt-3">{data.blocks.map((b) => <BlockCard key={b.id} block={b} compact={false} />)}</div>}
    </details>
  );
}

function TimelineBlock({ data }: { data: TimelineBlockData }) {
  if (!data.events) return <div className="text-xs" style={{ color: "var(--subtle)" }}>No timeline events</div>;
  const events = data.events.map((e) => ({ ...e, year: typeof e.year === "string" ? parseInt(e.year, 10) || 0 : e.year }));
  return (
    <div className="pixel-card-sm p-3 mb-3 bg-white overflow-hidden">
      <InteractiveTimeline events={events} />
    </div>
  );
}

function Map2DBlock({ data }: { data: Map2DBlockData }) {
  return (
    <div className="pixel-card-sm p-3 mb-3 bg-white overflow-hidden" style={{ height: "clamp(250px, 50vh, 400px)" }}>
      <MapViewer markers={data.markers} layers={data.layers} centerLat={data.centerLat} centerLng={data.centerLng} zoom={data.zoom} />
    </div>
  );
}

function Map3DBlock({ data }: { data: Map3DBlockData }) {
  return (
    <div className="pixel-card-sm p-3 mb-3 bg-white overflow-hidden" style={{ height: "clamp(250px, 50vh, 400px)" }}>
      <ThreeDMapViewer scene={data as any} />
    </div>
  );
}

function DiagramBlock({ data }: { data: DiagramBlockData }) {
  return (
    <div className="pixel-card-sm p-3 mb-3 bg-white">
      {data.caption && <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>{data.caption}</div>}
      <MermaidDiagram code={data.code} />
    </div>
  );
}

function ImageBlock({ data }: { data: ImageBlockData }) {
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
    <div className="pixel-card-sm p-2 mb-3 bg-white">
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
  if (!data.images || data.images.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
      {data.images.filter(Boolean).map((img, i) => (
        <MediaImage key={i} src={img.src} caption={img.caption} prompt={img.prompt} />
      ))}
    </div>
  );
}

function CitationBlock({ data }: { data: CitationBlockData }) {
  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      className="pixel-card-sm p-2 flex items-center gap-2 mb-2 bg-white"
      style={{ textDecoration: "none", color: "inherit", fontSize: "0.85rem" }}
    >
      <span>🔗</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate font-semibold">{data.title || data.url}</span>
        {data.relevance && <span className="block text-xs" style={{ color: "var(--muted)" }}>{data.relevance}</span>}
      </span>
    </a>
  );
}

function CrossrefBlock({ data }: { data: CrossrefBlockData }) {
  return (
    <Link href={`/article/${data.slug}`}
      className="pixel-card-sm p-2 flex items-center gap-2 mb-2 bg-white"
      style={{ textDecoration: "none", color: "inherit", fontSize: "0.85rem" }}
    >
      <span>🔁</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate font-semibold">{data.title || data.slug}</span>
        {data.relationship && <span className="block text-xs" style={{ color: "var(--muted)" }}>{data.relationship}</span>}
      </span>
      <span style={{ color: "var(--orange)", fontSize: "1.2rem" }}>→</span>
    </Link>
  );
}

function ToolCallBlock({ data }: { data: { name: string; args?: Record<string, unknown>; result?: string } }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1 px-2 rounded mb-1" style={{ background: "#f0f7ff" }}>
      <span>⚡ {data.name}</span>
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
