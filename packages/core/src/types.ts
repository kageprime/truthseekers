export interface Citation {
  url: string;
  title: string;
  accessed: string;
  relevance: string;
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
  freshness: string;
}

export type JobStatus = "queued" | "researching" | "writing" | "verifying" | "media" | "storing" | "done" | "error";

export interface JobInfo {
  slug: string;
  title?: string;
  status: JobStatus;
  phase: string;
  createdAt: string;
  error?: string;
}

export interface PageView {
  slug: string;
  depth: "simple" | "intermediate" | "advanced";
}

export type Persona = "veritas" | "pliny";
