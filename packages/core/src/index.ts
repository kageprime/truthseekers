// LLM layer
export { sendPrompt, sendPromptStream, webSearch, tavilySearch, embedText } from "./llm.js";

// Model routing
export { resolveModel, buildModel } from "./models.js";
export type { Message, ToolDefinition, ToolCall, PromptResult, ToolChoice, Usage } from "./models.js";

// Agent (unified loop)
export { Agent } from "./agent/index.js";
export type { AgentConfig, AgentResult, AgentTool, ToolResult, ToolExecutor } from "./agent/index.js";

// Chat tools (13 tool definitions + 4 built-in executors)
export { CHAT_TOOL_DEFINITIONS, BUILT_IN_TOOL_EXECUTORS } from "./tools.js";

// Pipeline tools (7 phase tools for article generation)
export { PIPELINE_TOOL_DEFINITIONS, PIPELINE_TOOL_EXECUTORS } from "./pipeline/tools.js";

// Pipeline orchestrator
export {
  runPipeline,
  researchPhase,
  outlinePhase,
  writePhase,
  verifyPhase,
  applyCorrections,
  mediaPhase,
  pipelineEvents,
  pauseAndVerify,
} from "./pipeline/orchestrator.js";

// Blocks
export { articleToBlocks, dedupeBlocks } from "./blocks.js";

// Queue & Redis
export { queue } from "./queue.js";
export { getRedisClient, getRedisSubscriber } from "./redis.js";

// Prompts
export {
  VERITAS_PREAMBLE,
  PLINY_SUFFIX,
  RESEARCHER_INSTRUCTIONS,
  OUTLINER_INSTRUCTIONS,
  WRITER_INSTRUCTIONS,
  VERIFIER_INSTRUCTIONS,
  MEDIA_GENERATOR_INSTRUCTIONS,
  MODELER_INSTRUCTIONS,
} from "./prompts/index.js";

// Types
export type {
  ModelId,
  AgentEvent,
  Article, ArticleContent, ArticleMetadata, ArticleOutline,
  ResearchResult, VerificationResult, MediaGenerationResult, MediaGenerationItem,
  Block, BlockType, Persona,
  JobInfo, JobStatus,
  Citation, CrossReference, TimelineEvent, Section, MediaItem,
  ThreeDScene, ThreeDMapScene, ThreeDBuilding, ThreeDModel, ThreeDAnnotation,
  MapEntry, MapMarker, MapLayer,
  HeadingBlockData, TextBlockData, SectionBlockData,
  TimelineBlockData, Map2DBlockData, Map3DBlockData,
  DiagramBlockData, ImageBlockData, VideoBlockData,
  GalleryBlockData, CitationBlockData, CrossrefBlockData,
  TableBlockData, ListBlockData,
  ArticleSummary, QuotaInfo, ConversationSummary, ConversationDetail,
} from "./types.js";
