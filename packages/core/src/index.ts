// Blocks (runtime — consumed by BlockRenderer.tsx)
export { articleToBlocks, dedupeBlocks } from "./blocks.js";

// Types (consumed as type-only imports across the web package)
export type {
  Block, BlockType,
  Article, ArticleContent, ArticleMetadata, ArticleOutline,
  ResearchResult, VerificationResult, MediaGenerationResult, MediaGenerationItem,
  Persona,
  JobInfo, JobStatus,
  Citation, CrossReference, TimelineEvent, Section, MediaItem,
  ThreeDMapScene, ThreeDBuilding, ThreeDModel, ThreeDAnnotation,
  MapEntry, MapMarker, MapLayer,
  HeadingBlockData, TextBlockData, SectionBlockData,
  TimelineBlockData, Map2DBlockData, Map3DBlockData,
  DiagramBlockData, ImageBlockData, VideoBlockData,
  GalleryBlockData, CitationBlockData, CrossrefBlockData,
  TableBlockData, ListBlockData,
  ArticleSummary, QuotaInfo, ConversationSummary, ConversationDetail,
  ModelId,
} from "./types.js";
