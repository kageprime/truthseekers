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

export interface ThreeDScene {
  id: string;
  code: string;
  description: string;
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

export interface MediaItem {
  type: "image" | "diagram" | "timeline" | "threed";
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
  threedScenes: ThreeDScene[];
}

export interface Article extends ArticleContent {
  slug: string;
  metadata: ArticleMetadata;
}

export interface ArticleMetadata {
  version: number;
  created: string;
  updated: string;
  status: "draft" | "published" | "error";
  freshness?: string;
}

export type JobStatus = "queued" | "researching" | "writing" | "verifying" | "media" | "storing" | "done" | "error" | "removed";

export interface AgentEvent {
  type: "tool_use" | "tool_result" | "text" | "status" | "error";
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
