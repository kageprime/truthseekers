export interface Citation {
  url: string;
  title: string;
  accessed?: string;
  relevance?: string;
}

export interface CrossReference {
  id: string;
  title: string;
  relationship: string;
}

export interface TimelineEvent {
  id?: string;
  year: number;
  event: string;
  description: string;
  image?: string;
  causes?: string[];
  category?: string;
}

export interface ThreeDBuilding {
  id: string;
  lat: number;
  lng: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  label?: string;
  type: "temple" | "forum" | "wall" | "aqueduct" | "house" | "palace" | "other";
}

export interface ThreeDModel {
  id: string;
  lat: number;
  lng: number;
  src: string;
  scale: number;
  rotation: number;
  label: string;
  caption?: string;
}

export interface ThreeDAnnotation {
  lat: number;
  lng: number;
  label: string;
  description: string;
  articleSlug?: string;
}

export interface ThreeDMapScene {
  id: string;
  title: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  terrain: {
    type: "flat" | "hills" | "mountain";
    color?: string;
    heightScale?: number;
  };
  buildings?: ThreeDBuilding[];
  models?: ThreeDModel[];
  annotations?: ThreeDAnnotation[];
}

export type ModelId = "muse-spark-1.3-contributor" | "gemma-4-31B-it" | "deepseek-4-flash" | "deepseek-v4-pro";

export interface MediaItem {
  type: "image" | "diagram" | "timeline" | "threed" | "video";
  id: string;
  caption: string;
  src?: string;
  source?: string;
  code?: string;
  prompt?: string;
}

export interface Section {
  id: string;
  title: string;
  content: string;
  media: MediaItem[];
}

export interface ResearchNote {
  key: string;
  value: string;
  source: string;
}

export interface ResearchResult {
  topic: string;
  summary: string;
  facts: ResearchNote[];
  sources: Citation[];
  relatedTopics: string[];
}

export interface ArticleOutline {
  topic: string;
  sections: { id: string; title: string; key_points: string[] }[];
  timelineEvents: TimelineEvent[];
  suggestedMedia: { section: string; type: string; description: string }[];
  categories: string[];
}

export interface ArticleContent {
  title: string;
  abstract: string;
  sections: Section[];
  timeline: TimelineEvent[];
  categories: string[];
  crossrefs: CrossReference[];
  citations: Citation[];
}

export interface Article extends ArticleContent {
  slug: string;
  metadata: ArticleMetadata;
  blocks?: Block[];
}

export interface ArticleMetadata {
  version: number;
  created: string;
  updated: string;
  status: "draft" | "published" | "error";
  freshness?: string;
  generatedBy?: string;
}

export type JobStatus = "queued" | "researching" | "writing" | "verifying" | "media" | "storing" | "done" | "error" | "removed" | "paused";

export interface AgentEvent {
  type: "tool_use" | "tool_result" | "text" | "status" | "error" | "trace";
  data: unknown;
  timestamp: number;
  label?: string;
}

export interface JobInfo {
  slug: string;
  title?: string;
  status: JobStatus;
  phase: string;
  createdAt: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

export interface PageView {
  slug: string;
  depth: "simple" | "intermediate" | "advanced";
}

export type Persona = "veritas" | "pliny";

export interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  type?: "city" | "battle" | "site" | "museum" | "other";
}

export interface MapLayer {
  id: string;
  label: string;
  year?: number;
  geoJson: object;
  visible?: boolean;
}

export interface MapEntry {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  content: string;
  image?: string;
  region?: string;
  era?: string;
  type: "static" | "interactive";
  externalUrl?: string;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  geoJson?: object;
  markers?: MapMarker[];
  layers?: MapLayer[];
  timeline?: TimelineEvent[];
  threedScene?: ThreeDMapScene;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationIssue {
  section: string;
  type: "factual" | "logical" | "citation" | "contradiction";
  description: string;
  suggestion: string;
}

export interface VerificationCorrection {
  section: string;
  original: string;
  corrected: string;
  reason: string;
}

export interface VerificationResult {
  verified: boolean;
  issues: VerificationIssue[];
  corrections: VerificationCorrection[];
  confidenceScore: number;
  summary: string;
}

export interface MediaGenerationItem {
  sectionId: string;
  mediaId: string;
  type: "image" | "diagram" | "threed" | "map3d";
  caption: string;
  prompt: string;
  status: "generated" | "skipped";
  src: string;
}

export interface MediaGenerationResult {
  mediaItems: MediaGenerationItem[];
}

// ── Block System ─────────────────────────────────────────────────────────
// Every piece of article content is a typed block. Blocks can nest, stream,
// and render as rich UI cards.

export type BlockType =
  | "heading"
  | "text"
  | "section"
  | "timeline"
  | "map_2d"
  | "map_3d"
  | "diagram"
  | "image"
  | "gallery"
  | "video"
  | "citation"
  | "crossref"
  | "tool_call"
  | "divider"
  | "table"
  | "list"
  | "pullquote";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
  meta?: {
    sectionId?: string;
    phase?: string;
    collapsed?: boolean;
  };
}

// Block data shapes (used at runtime for validation, typed here as interfaces)
export interface HeadingBlockData {
  level: 1 | 2 | 3;
  text: string;
}

export interface TextBlockData {
  content: string; // markdown
}

export interface SectionBlockData {
  title: string;
  blocks?: Block[];
}

export interface TimelineBlockData {
  events: Array<Omit<TimelineEvent, "year"> & { year: number | string }>;
}

export interface Map2DBlockData {
  markers?: MapMarker[];
  layers?: MapLayer[];
  geoJson?: object;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
}

export interface Map3DBlockData {
  terrain?: {
    type: "flat" | "hills" | "mountain";
    color?: string;
    heightScale?: number;
  };
  buildings?: ThreeDBuilding[];
  annotations?: ThreeDAnnotation[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
}

export interface DiagramBlockData {
  code: string; // mermaid.js code
  caption?: string;
}

export interface ImageBlockData {
  src: string;
  caption?: string;
  prompt?: string;
  source?: string;
}

export interface VideoBlockData {
  src: string;
  caption?: string;
  prompt?: string;
  poster?: string;
}

export interface GalleryBlockData {
  images: Array<{ src: string; caption?: string; prompt?: string }>;
  caption?: string;
  source?: string;
}

export interface CitationBlockData {
  url: string;
  title: string;
  relevance?: string;
  accessed?: string;
}

export interface CrossrefBlockData {
  slug: string;
  title: string;
  relationship?: string;
}

export interface ToolCallBlockData {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface TableBlockData {
  headers?: string[];
  rows?: string[][];
  caption?: string;
  source?: string;
}

export interface ListBlockData {
  style?: "ordered" | "unordered";
  items: string[];
}

// ── API Response Shapes ────────────────────────────────────────────────────

export interface ArticleSummary {
  slug: string;
  title: string;
  abstract: string;
  metadata: { status: string; version: number; updated: string };
  categories: string[];
  thumbnail?: string;
}

export interface QuotaInfo {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  tier: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Array<{
    id: string;
    conversationId: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    blocks?: Block[];
    tool_calls?: any[];
    tool_call_id?: string;
    tool_name?: string;
    agentEvents?: any[];
    createdAt: string;
  }>;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  blocks?: Block[];
  createdAt: string;
}
