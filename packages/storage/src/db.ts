import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import mongoose, { Schema, type Model, type Document } from "mongoose";
import type { Article, ArticleContent, ArticleMetadata, MapEntry, ThreeDMapScene, Block } from "@encarta/core";

// Load root .env before accessing env vars
dotenv.config({ path: path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MOONGOSE_CONNECTION_STRING || "mongodb://localhost:27017/encarta";

let initialized = false;

export async function initDb(): Promise<void> {
  if (initialized) return;

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected — attempting reconnect...");
    initialized = false;
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
    initialized = true;
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    heartbeatFrequencyMS: 10000,
  });
  initialized = true;
  await ensureIndexes();
}

export async function pingDb(): Promise<boolean> {
  try {
    if (!mongoose.connection.readyState || mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export function getDb(): mongoose.Connection {
  return mongoose.connection;
}

export async function closeDb(): Promise<void> {
  if (initialized) {
    await mongoose.disconnect();
    initialized = false;
  }
}

// ── Schemas ──────────────────────────────────────────────────────────────

const mediaItemSchema = new Schema({
  type: { type: String, enum: ["image", "diagram", "timeline", "threed"], required: true },
  id: { type: String },
  caption: { type: String },
  src: { type: String },
  source: { type: String },
  code: { type: String },
  prompt: { type: String },
}, { _id: false });

const sectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  media: { type: [mediaItemSchema], default: [] },
}, { _id: false });

const citationSchema = new Schema({
  url: { type: String, required: true },
  title: { type: String },
  accessed: { type: String },
  relevance: { type: String },
}, { _id: false });

const crossRefSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String },
  relationship: { type: String },
}, { _id: false });

const timelineEventSchema = new Schema({
  id: { type: String },
  year: { type: Schema.Types.Mixed, required: true },
  event: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  causes: { type: [String] },
  category: { type: String },
}, { _id: false });

const threedSceneSchema = new Schema({
  id: { type: String, required: true },
  code: { type: String },
  description: { type: String },
}, { _id: false });

const metadataSchema = new Schema({
  version: { type: Number, default: 1 },
  created: { type: String },
  updated: { type: String },
  status: { type: String, enum: ["draft", "published", "error"], default: "draft" },
  freshness: { type: String },
}, { _id: false });

const blockSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  meta: { type: Schema.Types.Mixed },
}, { _id: false });

const articleSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  abstract: { type: String, required: true },
  sections: { type: [sectionSchema], default: [] },
  timeline: { type: [timelineEventSchema], default: [] },
  categories: { type: [String], default: [] },
  crossrefs: { type: [crossRefSchema], default: [] },
  citations: { type: [citationSchema], default: [] },
  threedScenes: { type: [threedSceneSchema], default: [] },
  blocks: { type: [blockSchema], default: [] },
  metadata: { type: metadataSchema, required: true },
});

const graphEdgeSchema = new Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
  relationship: { type: String, default: "related" },
}, { _id: false });

graphEdgeSchema.index({ source: 1, target: 1 }, { unique: true });
graphEdgeSchema.index({ source: 1 });
graphEdgeSchema.index({ target: 1 });

const mapMarkerSchema = new Schema({
  lat: { type: Number },
  lng: { type: Number },
  title: { type: String },
  description: { type: String },
  type: { type: String, enum: ["city", "battle", "site", "museum", "other"] },
}, { _id: false });

const mapLayerSchema = new Schema({
  id: { type: String },
  label: { type: String },
  year: { type: Number },
  geoJson: { type: Schema.Types.Mixed },
  visible: { type: Boolean, default: true },
}, { _id: false });

const mapTimelineEventSchema = new Schema({
  year: { type: Schema.Types.Mixed },
  event: { type: String },
  description: { type: String },
  category: { type: String },
}, { _id: false });

const buildingSchema = new Schema({
  id: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  width: { type: Number },
  depth: { type: Number },
  height: { type: Number },
  color: { type: String },
  label: { type: String },
  type: { type: String, enum: ["temple", "forum", "wall", "aqueduct", "house", "palace", "other"] },
}, { _id: false });

const annotationSchema = new Schema({
  lat: { type: Number },
  lng: { type: Number },
  label: { type: String },
  description: { type: String },
  articleSlug: { type: String },
}, { _id: false });

const terrainSchema = new Schema({
  type: { type: String, enum: ["flat", "hills", "mountain"] },
  color: { type: String },
  heightScale: { type: Number },
}, { _id: false });

const threedMapSceneSchema = new Schema({
  id: { type: String },
  title: { type: String },
  centerLat: { type: Number },
  centerLng: { type: Number },
  zoom: { type: Number },
  terrain: { type: terrainSchema },
  buildings: { type: [buildingSchema] },
  models: { type: [new Schema({ id: String, lat: Number, lng: Number, src: String, scale: Number, rotation: Number, label: String, caption: String }, { _id: false })] },
  annotations: { type: [annotationSchema] },
}, { _id: false });

const mapEntrySchema = new Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String },
  description: { type: String, required: true },
  content: { type: String, default: "" },
  image: { type: String },
  region: { type: String },
  era: { type: String },
  type: { type: String, enum: ["static", "interactive"], required: true },
  externalUrl: { type: String },
  centerLat: { type: Number },
  centerLng: { type: Number },
  zoom: { type: Number, default: 5 },
  geoJson: { type: Schema.Types.Mixed },
  markers: { type: [mapMarkerSchema], default: [] },
  layers: { type: [mapLayerSchema], default: [] },
  timeline: { type: [mapTimelineEventSchema], default: [] },
  threedScene: { type: threedMapSceneSchema },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

const articleViewSchema = new Schema({
  slug: { type: String, required: true },
  event: { type: String, default: "view" },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now },
});

articleViewSchema.index({ slug: 1 });
articleViewSchema.index({ createdAt: -1 });

// ── Models ───────────────────────────────────────────────────────────────

interface IArticleDocument extends Document {
  slug: string;
  title: string;
  abstract: string;
  sections: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  categories: string[];
  crossrefs: Record<string, unknown>[];
  citations: Record<string, unknown>[];
  threedScenes: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

const ArticleModel: Model<IArticleDocument> = mongoose.model<IArticleDocument>("Article", articleSchema);
const GraphEdgeModel = mongoose.model("GraphEdge", graphEdgeSchema);
const MapEntryModel = mongoose.model("MapEntry", mapEntrySchema);
const ArticleViewModel = mongoose.model("ArticleView", articleViewSchema);

const jobSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  status: { type: String, enum: ["queued", "researching", "writing", "outlining", "verifying", "correcting", "media", "images", "storing", "done", "error"], required: true },
  phase: { type: String, default: "pending" },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  error: { type: String },
  meta: { type: Schema.Types.Mixed },
});

const JobModel = mongoose.model("Job", jobSchema);

export { ArticleModel, GraphEdgeModel, MapEntryModel, ArticleViewModel, JobModel };

async function ensureIndexes(): Promise<void> {
  await ArticleModel.createIndexes();
  await GraphEdgeModel.createIndexes();
  await MapEntryModel.createIndexes();
  await ArticleViewModel.createIndexes();

  // Basic text index for fallback search (when Atlas Search not configured)
  try {
    await ArticleModel.collection.createIndex(
      { title: "text", abstract: "text", "sections.content": "text" },
      { name: "article_text", default_language: "none", background: true }
    );
  } catch {
    // index may already exist
  }

  await seedMaps();
}

const ATLAS_SEARCH_ENABLED = process.env.ATLAS_SEARCH_ENABLED === "true";

function docToArticle(doc: IArticleDocument): Article;
function docToArticle(doc: Record<string, unknown>): Article;
function docToArticle(doc: any): Article {
  const content = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    slug: content.slug,
    title: content.title,
    abstract: content.abstract,
    sections: content.sections as ArticleContent["sections"],
    timeline: content.timeline as ArticleContent["timeline"],
    categories: content.categories,
    crossrefs: content.crossrefs as ArticleContent["crossrefs"],
    citations: content.citations as ArticleContent["citations"],
    threedScenes: content.threedScenes as ArticleContent["threedScenes"],
    blocks: content.blocks as Block[] | undefined,
    metadata: content.metadata as ArticleMetadata,
  };
}

function flattenContent(content: ArticleContent | Article): string {
  return [
    content.title,
    content.abstract,
    ...content.sections.map((s) => `${s.title} ${s.content}`),
  ].join(" ");
}

function articleToContent(article: Article): ArticleContent {
  return {
    title: article.title,
    abstract: article.abstract,
    sections: article.sections,
    timeline: article.timeline,
    categories: article.categories,
    crossrefs: article.crossrefs,
    citations: article.citations,
    threedScenes: article.threedScenes,
  };
}

// ── Article CRUD ─────────────────────────────────────────────────────────

export async function upsertArticle(article: Article): Promise<void> {
  const existing = await getArticle(article.slug);
  const now = new Date().toISOString();
  const version = existing ? existing.metadata.version + 1 : 1;

  const metadata: ArticleMetadata = {
    ...article.metadata,
    version,
    updated: now,
    freshness: now,
  };

  await ArticleModel.findOneAndUpdate(
    { slug: article.slug },
    {
      $set: {
        ...articleToContent(article),
        metadata,
        slug: article.slug,
      },
    },
    { upsert: true, new: true }
  );

  await upsertGraphEdges(article.slug, article.crossrefs);
}

export async function getArticle(slug: string): Promise<Article | null> {
  const doc = await ArticleModel.findOne({ slug }).lean();
  if (!doc) return null;
  return docToArticle(doc as unknown as IArticleDocument);
}

export async function getArticleStatus(slug: string): Promise<"draft" | "published" | "error" | null> {
  const doc = await ArticleModel.findOne({ slug }, { "metadata.status": 1 }).lean();
  if (!doc) return null;
  const meta = (doc as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
  return (meta?.status as "draft" | "published" | "error") ?? null;
}

export async function listArticles(
  limit = 50,
  offset = 0
): Promise<(Pick<Article, "slug" | "title" | "abstract" | "metadata" | "categories"> & { thumbnail?: string })[]> {
  const docs = await ArticleModel.find(
    { "metadata.status": "published" },
    { slug: 1, title: 1, abstract: 1, metadata: 1, categories: 1, sections: 1 }
  )
    .sort({ "metadata.updated": -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return docs.map((doc) => {
    const d = doc as Record<string, unknown>;
    let thumbnail: string | undefined;
    try {
      const sections = d.sections as Array<Record<string, unknown>> | undefined;
      if (sections) {
        for (const sec of sections) {
          const media = sec.media as Array<Record<string, unknown>> | undefined;
          const img = media?.find((m) => m.type === "image" && m.src);
          if (img) { thumbnail = img.src as string; break; }
        }
      }
    } catch { /* no thumbnail */ }
    return {
      slug: d.slug as string,
      title: d.title as string,
      abstract: d.abstract as string,
      metadata: d.metadata as ArticleMetadata,
      categories: (d.categories || []) as string[],
      thumbnail,
    };
  });
}

export async function searchArticles(
  query: string,
  limit = 20
): Promise<Pick<Article, "slug" | "title" | "abstract">[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  let docs: Array<Record<string, unknown>>;

  if (ATLAS_SEARCH_ENABLED) {
    docs = await ArticleModel.collection.aggregate([
      {
        $search: {
          index: "articles_fulltext",
          text: {
            query: query,
            path: ["title", "abstract", "sections.content"],
          },
        } as any,
      },
      { $project: { slug: 1, title: 1, abstract: 1 } },
      { $limit: limit },
    ]).toArray() as unknown as Array<Record<string, unknown>>;
  } else {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    docs = await ArticleModel.find(
      { $text: { $search: escaped }, "metadata.status": "published" },
      { slug: 1, title: 1, abstract: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean() as unknown as Array<Record<string, unknown>>;
  }

  return docs.map((d) => ({
    slug: d.slug as string,
    title: d.title as string,
    abstract: d.abstract as string,
  }));
}

// ── Memory (Key-Value Store) ─────────────────────────────────────────────

const memorySchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const MemoryModel = mongoose.models.Memory ?? mongoose.model("Memory", memorySchema);

export async function memStore(key: string, value: string): Promise<void> {
  await MemoryModel.findOneAndUpdate(
    { key },
    { key, value, updatedAt: new Date() },
    { upsert: true },
  );
}

export async function memRecall(key: string): Promise<string | null> {
  const doc = await MemoryModel.findOne({ key }).lean();
  return doc ? (doc as any).value : null;
}

export async function memRecallAll(): Promise<Array<{ key: string; value: string }>> {
  const docs = await MemoryModel.find({}).lean();
  return docs.map((d: any) => ({ key: d.key, value: d.value }));
}

// ── API Keys ──────────────────────────────────────────────────────────────

const apiKeySchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  tier: { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
});

const ApiKeyModel = mongoose.models.ApiKey ?? mongoose.model("ApiKey", apiKeySchema);

export { ApiKeyModel };

export async function createApiKey(name: string, tier: "free" | "pro" | "enterprise" = "free"): Promise<{ id: string; key: string; name: string; tier: string }> {
  const raw = `enc_${randomBytes(32).toString("hex")}`;
  const doc = await ApiKeyModel.create({ key: raw, name, tier });
  return { id: doc._id.toString(), key: doc.key, name: doc.name, tier: doc.tier };
}

export async function listApiKeys(): Promise<Array<{ id: string; name: string; tier: string; active: boolean; createdAt: Date; lastUsedAt?: Date }>> {
  const docs: any[] = await ApiKeyModel.find().sort({ createdAt: -1 }).lean();
  return docs.map((d: any) => ({ id: d._id.toString(), name: d.name, tier: d.tier, active: d.active, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt }));
}

export async function revokeApiKey(id: string): Promise<void> {
  await ApiKeyModel.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { active: false });
}

export async function getApiKey(key: string): Promise<{ id: string; tier: string; active: boolean } | null> {
  const doc: any = await ApiKeyModel.findOne({ key }).lean();
  if (!doc) return null;
  return { id: doc._id.toString(), tier: doc.tier as string, active: doc.active as boolean };
}

export async function touchApiKey(key: string): Promise<void> {
  await ApiKeyModel.updateOne({ key }, { lastUsedAt: new Date() });
}

// ── Users ─────────────────────────────────────────────────────────────────

const userSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: "" },
  avatar: { type: String, default: "" },
  stripeCustomerId: { type: String },
  subscriptionTier: { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
  onboarded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);

export { UserModel };

export async function createUser(id: string, email: string): Promise<{ id: string; email: string; name: string; avatar: string; subscriptionTier: string; onboarded: boolean; createdAt: Date }> {
  const doc = await UserModel.create({ id, email });
  return { id: doc.id, email: doc.email, name: doc.name, avatar: doc.avatar, subscriptionTier: doc.subscriptionTier, onboarded: doc.onboarded, createdAt: doc.createdAt };
}

export async function getUserByEmail(email: string): Promise<{ id: string; email: string; name: string; avatar: string; subscriptionTier: string; onboarded: boolean } | null> {
  const doc: any = await UserModel.findOne({ email }).lean();
  if (!doc) return null;
  return { id: doc.id, email: doc.email, name: doc.name, avatar: doc.avatar, subscriptionTier: doc.subscriptionTier, onboarded: doc.onboarded };
}

export async function getUserById(id: string): Promise<{ id: string; email: string; name: string; avatar: string; subscriptionTier: string; onboarded: boolean } | null> {
  const doc: any = await UserModel.findOne({ id }).lean();
  if (!doc) return null;
  return { id: doc.id, email: doc.email, name: doc.name, avatar: doc.avatar, subscriptionTier: doc.subscriptionTier, onboarded: doc.onboarded };
}

export async function updateUser(id: string, updates: { name?: string; avatar?: string }): Promise<void> {
  await UserModel.updateOne({ id }, { $set: updates });
}

export async function setUserOnboarded(id: string): Promise<void> {
  await UserModel.updateOne({ id }, { $set: { onboarded: true } });
}

// ── Graph Edges ──────────────────────────────────────────────────────────

export async function upsertGraphEdges(
  source: string,
  refs: { id: string; title: string; relationship: string }[]
): Promise<void> {
  const ops = refs.map((ref) => ({
    updateOne: {
      filter: { source, target: ref.id },
      update: { $set: { source, target: ref.id, relationship: ref.relationship ?? "related" } },
      upsert: true,
    },
  }));
  if (ops.length > 0) {
    await GraphEdgeModel.bulkWrite(ops);
  }
}

export async function getGraphEdges(slug: string): Promise<{ target: string; relationship: string }[]> {
  return await GraphEdgeModel.find({ source: slug }, { _id: 0, target: 1, relationship: 1 }).lean();
}

export async function getBacklinks(slug: string): Promise<{ source: string; relationship: string }[]> {
  return await GraphEdgeModel.find({ target: slug }, { _id: 0, source: 1, relationship: 1 }).lean();
}

// ── Maps ─────────────────────────────────────────────────────────────────

export async function upsertMap(map: MapEntry): Promise<void> {
  await MapEntryModel.findOneAndUpdate(
    { slug: map.slug },
    { $set: map },
    { upsert: true, new: true }
  );
}

export async function getMap(slug: string): Promise<MapEntry | null> {
  const doc = await MapEntryModel.findOne({ slug }).lean();
  if (!doc) return null;
  return docToMapEntry(doc as Record<string, unknown>);
}

function docToMapEntry(row: Record<string, unknown>): MapEntry {
  return {
    slug: row.slug as string,
    title: row.title as string,
    subtitle: (row.subtitle as string) || undefined,
    description: row.description as string,
    content: row.content as string,
    image: (row.image as string) || undefined,
    region: (row.region as string) || undefined,
    era: (row.era as string) || undefined,
    type: row.type as "static" | "interactive",
    externalUrl: (row.externalUrl as string) || undefined,
    centerLat: (row.centerLat as number) || undefined,
    centerLng: (row.centerLng as number) || undefined,
    zoom: (row.zoom as number) || undefined,
    geoJson: row.geoJson as object | undefined,
    markers: (row.markers as MapEntry["markers"]) || undefined,
    layers: (row.layers as MapEntry["layers"]) || undefined,
    timeline: (row.timeline as MapEntry["timeline"]) || undefined,
    threedScene: row.threedScene as MapEntry["threedScene"] || undefined,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export async function listMaps(limit = 50, offset = 0): Promise<MapEntry[]> {
  const docs = await MapEntryModel.find({ type: "static" })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
  return docs.map((d) => docToMapEntry(d as Record<string, unknown>));
}

export async function listInteractiveMaps(): Promise<MapEntry[]> {
  const docs = await MapEntryModel.find({ type: "interactive" })
    .sort({ createdAt: 1 })
    .lean();
  return docs.map((d) => docToMapEntry(d as Record<string, unknown>));
}

export async function searchMaps(query: string, limit = 20): Promise<MapEntry[]> {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = await MapEntryModel.find({
    type: "static",
    $or: [
      { title: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
      { region: { $regex: escaped, $options: "i" } },
      { era: { $regex: escaped, $options: "i" } },
    ],
  })
    .limit(limit)
    .lean();
  return docs.map((d) => docToMapEntry(d as Record<string, unknown>));
}

// ── Seed Data ────────────────────────────────────────────────────────────

async function seedMaps(): Promise<void> {
  const count = await MapEntryModel.countDocuments();
  if (count > 0) return;

  const now = new Date().toISOString();

  const staticMaps: MapEntry[] = [
    {
      slug: "taifa-kingdoms-1031-1086",
      title: "Map of the Taifa Kingdoms of Iberia, 1031–1086",
      subtitle: "Al-Andalus between Córdoba and the Almoravids",
      description: "The first taifa period followed the collapse of Umayyad authority in Córdoba. Al-Andalus fragmented into over 30 independent kingdoms, each centered on a major city. The map shows the shifting borders and rivalries that weakened Muslim Iberia, ultimately enabling Christian kingdoms to expand southward in the Reconquista.",
      content: "The taifa (from Arabic طائفة ṭā'ifa, plural طوائف ṭawā'if, meaning 'party' or 'faction') kingdoms emerged after the fitna (civil war) that toppled the Caliphate of Córdoba in 1031. The period is traditionally divided into two phases: the first taifa period (1031–c. 1086) and the second taifa period (after Almoravid decline).\n\n**Major Taifa Kingdoms:**\n- **Taifa of Seville** — The most powerful, led by the Abbadid dynasty, eventually annexed many smaller taifas\n- **Taifa of Toledo** — A major cultural and intellectual center under the Dhulnunids\n- **Taifa of Zaragoza** — Ruled by the Banu Hud dynasty, resisted Christian pressure\n- **Taifa of Granada** — Controlled by the Zirids, later fell to the Almoravids\n- **Taifa of Badajoz** — The largest by territory, ruled by the Aftasids\n\nBy 1086, internal divisions and Christian military pressure led the taifa kings to call upon the Almoravids of North Africa for aid, who subsequently absorbed Al-Andalus into their empire.",
      image: "/maps/taifa-kingdoms.png",
      region: "Iberia",
      era: "Medieval",
      type: "static",
      timeline: [
        { year: 1031, event: "Collapse of the Caliphate of Córdoba", description: "The Umayyad Caliphate of Córdoba dissolved after a prolonged civil war (fitna), fragmenting into over 30 rival taifa kingdoms.", category: "politics" },
        { year: 1035, event: "Emergence of taifa kingdoms", description: "Al-Andalus splits into more than 30 independent city-state kingdoms, each ruled by a different dynasty — Arab, Berber, or Slavic.", category: "politics" },
        { year: 1055, event: "Christian parias system begins", description: "Christian kingdoms like Castile and León begin demanding tribute (parias) from the taifas in exchange for protection, draining Muslim treasuries.", category: "war" },
        { year: 1085, event: "Fall of Toledo to Alfonso VI", description: "The Taifa of Toledo, weakened by internal strife, falls to King Alfonso VI of Castile, a major turning point in the Reconquista.", category: "war" },
        { year: 1086, event: "Battle of Sagrajas (Zallaqa)", description: "Almoravids intervene at the request of the taifa kings, defeating Alfonso VI but subsequently absorbing Al-Andalus into their North African empire.", category: "war" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "american-revolutionary-war-1775-1783",
      title: "Map of the American Revolutionary War, 1775–1783",
      subtitle: "Campaigns, Battles & Naval Power in the War for Independence",
      description: "The American Revolutionary War or American War of Independence (1775–1783) was fought between Great Britain and the Thirteen Colonies, which secured independence and established the United States of America. This map traces the major campaigns from Lexington and Concord to the final siege at Yorktown.",
      content: "The conflict began with the Battles of Lexington and Concord on April 19, 1775, following years of escalating tensions over taxation without representation and British Parliamentary overreach.\n\n**Major Campaigns:**\n- **Northern Theater (1775–1777)** — Siege of Boston, Invasion of Canada, New York and New Jersey campaign\n- **Saratoga Campaign (1777)** — American victory that convinced France to enter the war as an ally\n- **Southern Theater (1778–1781)** — British shifted focus to the southern colonies, with key battles at Savannah, Charleston, and Cowpens\n- **Yorktown Campaign (1781)** — Franco-American cooperation trapped Cornwallis, leading to British surrender\n\n**Key Naval Battles include** the Battle of Valcour Island, Battle of Flamborough Head, and the Battle of the Chesapeake (a decisive French naval victory that sealed Cornwallis's fate).",
      image: "/maps/american-revolutionary-war.jpg",
      region: "North America",
      era: "Early Modern",
      type: "static",
      timeline: [
        { year: 1775, event: "Battles of Lexington and Concord", description: "The first military engagements of the Revolutionary War. British troops sent to confiscate colonial weapons clash with Massachusetts militia.", category: "war" },
        { year: 1776, event: "Declaration of Independence", description: "The Second Continental Congress adopts the Declaration of Independence, formally severing ties with Great Britain.", category: "politics" },
        { year: 1777, event: "Battle of Saratoga", description: "A decisive American victory that convinces France to enter the war as an ally, providing crucial military and financial support.", category: "war" },
        { year: 1781, event: "Siege of Yorktown", description: "Franco-American forces under Washington and Rochambeau trap Cornwallis's army, leading to the last major land battle of the war.", category: "war" },
        { year: 1783, event: "Treaty of Paris", description: "Great Britain formally recognizes American independence. The treaty establishes borders for the new United States.", category: "politics" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "first-anglo-boer-war-1880-1881",
      title: "Map of the First Anglo-Boer War, 1880–1881",
      subtitle: "Resistance, Imperial Overreach & the Limits of British Power",
      description: "The First Anglo-Boer War (1880-1881) emerged from growing tensions following the British annexation of the Transvaal in 1877. The Boers, descendants of Dutch settlers, mounted a successful guerrilla campaign that humbled the British Empire and restored the South African Republic's independence.",
      content: "The war is also known as the Transvaal War or the Transvaal Rebellion. It erupted on December 20, 1880 when Boer forces attacked a British army column at Bronkhorstspruit.\n\n**Key Battles:**\n- **Bronkhorstspruit (Dec 20, 1880)** — Ambush of the 94th Regiment\n- **Laing's Nek (Jan 28, 1881)** — British frontal assault repulsed with heavy casualties\n- **Schuinshoogte (Feb 8, 1881)** — Boer victory under Commandant-General Piet Joubert\n- **Majuba Hill (Feb 27, 1881)** — Decisive Boer victory; British commander Major-General Sir George Colley killed\n\nThe war ended with the Pretoria Convention (August 3, 1881), granting the Transvaal self-government under British suzerainty.",
      image: "/maps/first-anglo-boer-war.svg",
      region: "South Africa",
      era: "Modern",
      type: "static",
      timeline: [
        { year: 1877, event: "British annexation of the Transvaal", description: "Britain annexes the South African Republic (Transvaal), citing financial instability and the threat of Zulu expansion.", category: "politics" },
        { year: 1880, event: "Battle of Bronkhorstspruit", description: "Boer forces ambush a British army column, triggering the start of the war. The 94th Regiment suffers heavy casualties.", category: "war" },
        { year: 1881, event: "Battle of Laing's Nek", description: "British forces under General Sir George Colley attempt to break through Boer positions but are repulsed with heavy losses.", category: "war" },
        { year: 1881, event: "Battle of Majuba Hill", description: "A decisive Boer victory. Colley is killed and British morale collapses. The battle becomes a symbol of Boer resistance.", category: "war" },
        { year: 1881, event: "Pretoria Convention", description: "The treaty grants the Transvaal self-government under British suzerainty, effectively ending the war and restoring Boer rule.", category: "politics" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "gupta-empire-golden-age",
      title: "Map of the Gupta Empire and India's Golden Age",
      subtitle: "Expansion, Trade, Learning & Culture Across South Asia",
      description: "The Gupta Empire (c. 320–550 CE) emerged from the Magadha region (modern Bihar) and expanded to cover most of the Indian subcontinent. This period is widely regarded as the Golden Age of India, marked by advancements in science, mathematics, astronomy, literature, and art.",
      content: "The Gupta Empire was founded by Sri Gupta (c. 240–280 CE), but the classical age began with Chandragupta I (c. 319–335 CE), who assumed the imperial title Maharajadhiraja ('King of Great Kings').\n\n**Major Rulers:**\n- **Chandragupta I (c. 319–335 CE)** — United the Ganges Plain\n- **Samudragupta (c. 335–375 CE)** — The 'Napoleon of India,' expanded the empire through conquest\n- **Chandragupta II Vikramaditya (c. 375–415 CE)** — Height of the empire; patron of arts and learning\n- **Kumaragupta I (c. 415–455 CE)** — Founded Nalanda University\n- **Skandagupta (c. 455–467 CE)** — Repelled the Huna (Hephthalite) invasions\n\n**Achievements:** Concept of zero developed by Indian mathematicians, the decimal system, Aryabhata's astronomical calculations, the Kama Sutra, the works of Kalidasa, and the Ajanta cave paintings.",
      image: "/maps/gupta-empire.png",
      region: "South Asia",
      era: "Ancient",
      type: "static",
      timeline: [
        { year: -319, event: "Chandragupta I ascends the throne", description: "Chandragupta I assumes the imperial title Maharajadhiraja, marking the beginning of the classical Gupta period.", category: "politics" },
        { year: -335, event: "Samudragupta's reign begins", description: "Known as the 'Napoleon of India,' Samudragupta expands the empire through a series of military campaigns across the subcontinent.", category: "war" },
        { year: -375, event: "Chandragupta II takes power", description: "Chandragupta II Vikramaditya ushers in the Golden Age of India, patronizing arts, literature, and science.", category: "culture" },
        { year: -400, event: "Height of the Gupta Golden Age", description: "Indian mathematics develops the concept of zero, the decimal system, and the works of mathematician Aryabhata.", category: "science" },
        { year: -455, event: "Skandagupta repels the Huna", description: "Gupta forces under Skandagupta successfully defend the empire against Hephthalite (White Huns) invasions.", category: "war" },
        { year: -500, event: "Decline of the Gupta Empire", description: "Internal divisions, succession disputes, and continued Huna pressure lead to the fragmentation and eventual collapse of the empire.", category: "politics" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "byzantine-empire-justinian",
      title: "Map of the Byzantine Empire at Its Height, 565 CE",
      subtitle: "The Roman Empire Reborn — Territories, Trade Routes & Military Campaigns under Justinian I",
      description: "At the death of Emperor Justinian I in 565 CE, the Byzantine (Eastern Roman) Empire had reached its greatest territorial extent, encompassing the entire Mediterranean basin. This map details the reconquest of former Roman provinces in Italy, North Africa, and Hispania.",
      content: "The Byzantine Empire, also called the Eastern Roman Empire, was the continuation of the Roman Empire in its eastern provinces during Late Antiquity and the Middle Ages.\n\n**Justinian's Reconquests:**\n- **Vandalic War (533–534)** — Belisarius recaptured North Africa\n- **Gothic War (535–554)** — Protracted campaign to retake Italy from the Ostrogoths\n- **Visigothic intervention (552)** — Byzantine control of southern Hispania\n\n**Key Features of the Map:**\n- The empire's heartland in Anatolia and the Balkans\n- The strategic importance of Constantinople at the crossroads of Europe and Asia\n- Major trade routes connecting the Mediterranean to the Silk Road\n- The Limes (fortified boundaries) along the Danube and Euphrates\nThe empire would never again reach this size, as the Lombard invasions, Slavic migrations, and later Arab conquests steadily reduced Byzantine territory.",
      image: "/maps/byzantine-empire.svg",
      region: "Mediterranean",
      era: "Medieval",
      type: "static",
      timeline: [
        { year: 527, event: "Justinian I becomes emperor", description: "Justinian ascends to the Byzantine throne with ambitions to restore the Roman Empire to its former glory.", category: "politics" },
        { year: 533, event: "Vandalic War", description: "General Belisarius leads a military expedition that swiftly reconquers North Africa from the Vandals.", category: "war" },
        { year: 535, event: "Gothic War begins", description: "Byzantine forces invade Italy, beginning a protracted conflict against the Ostrogoths that lasts nearly two decades.", category: "war" },
        { year: 537, event: "Hagia Sophia completed", description: "The magnificent Hagia Sophia cathedral is completed in Constantinople, showcasing Byzantine engineering and artistry.", category: "culture" },
        { year: 552, event: "Byzantines take southern Hispania", description: "Byzantine forces intervene in Visigothic Spain, securing a foothold in the southern Iberian Peninsula.", category: "war" },
        { year: 565, event: "Death of Justinian I", description: "Justinian dies, leaving the Byzantine Empire at its greatest territorial extent, stretching from Spain to Mesopotamia.", category: "politics" },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  await MapEntryModel.insertMany(staticMaps);

  const interactiveMaps: MapEntry[] = [
    {
      slug: "roman-empire-interactive",
      title: "Interactive Map of the Roman Empire",
      description: "Explore the Roman Empire at its height under Trajan (117 CE) and its division under Justinian (565 CE). Click provinces and cities for historical details.",
      content: "The Roman Empire was one of the largest empires in history, spanning from Britannia to Mesopotamia. This interactive map shows the empire's provinces, major cities, and military roads.\n\n**Layers:**\n- **Roman Empire under Trajan (117 CE)** — Maximum extent of the Roman Empire\n- **Byzantine Empire under Justinian (565 CE)** — The empire after the split\n\n**Key Cities:**\n- **Rome** — Capital of the empire\n- **Constantinople** — Capital of the Eastern Roman Empire\n- **Alexandria** — Major center of learning\n- **Antioch** — Key city in the east\n- **Carthage** — Major North African city\n\nClick markers and provinces to learn more about each location.",
      region: "Europe / Mediterranean",
      era: "Classical",
      type: "interactive",
      centerLat: 38,
      centerLng: 15,
      zoom: 4,
      markers: [
        { lat: 41.9028, lng: 12.4964, title: "Rome", description: "Capital of the Roman Empire", type: "city" },
        { lat: 41.0082, lng: 28.9784, title: "Constantinople", description: "Capital of the Eastern Roman Empire", type: "city" },
        { lat: 31.2001, lng: 29.9187, title: "Alexandria", description: "Major center of Hellenistic learning", type: "city" },
        { lat: 36.2155, lng: 36.1568, title: "Antioch", description: "Key eastern metropolis and early Christian center", type: "city" },
        { lat: 36.8529, lng: 10.3232, title: "Carthage", description: "Major North African city, capital of Africa Proconsularis", type: "city" },
        { lat: 43.2965, lng: 5.3698, title: "Massilia", description: "Greek colony and major Mediterranean port", type: "city" },
        { lat: 48.8566, lng: 2.3522, title: "Lutetia", description: "Settlement on the Seine, precursor to Paris", type: "city" },
        { lat: 51.5074, lng: -0.1278, title: "Londinium", description: "Major settlement in Roman Britain", type: "city" },
        { lat: 52.3702, lng: 4.8952, title: "Traiectum", description: "Roman fort on the Rhine frontier", type: "city" },
      ],
      threedScene: createDefaultRomeScene(),
      timeline: [
        { year: -27, event: "Augustus becomes first emperor", description: "Octavian receives the title Augustus, marking the end of the Roman Republic and the beginning of the Roman Empire.", category: "politics" },
        { year: 117, event: "Empire at maximum extent under Trajan", description: "The Roman Empire reaches its greatest territorial extent, spanning from Britannia to Mesopotamia.", category: "war" },
        { year: 330, event: "Constantinople dedicated", description: "Constantine the Great dedicates the new capital of the Roman Empire on the site of ancient Byzantium.", category: "culture" },
        { year: 476, event: "Fall of the Western Roman Empire", description: "The Germanic chieftain Odoacer deposes the last Western Roman emperor, Romulus Augustulus.", category: "war" },
        { year: 565, event: "Byzantine Empire at its height under Justinian", description: "The Eastern Roman Empire reaches its maximum territorial extent under Emperor Justinian I.", category: "war" },
      ],
      layers: [
        {
          id: "roman-empire-117",
          label: "Roman Empire under Trajan (117 CE)",
          year: 117,
          visible: true,
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { name: "Roman Empire", period: "117 CE", fillColor: "#decd87" },
                geometry: {
                  type: "Polygon",
                  coordinates: [[[-9, 36], [-9, 44], [-5, 44], [-5, 48], [2, 49], [6, 51], [9, 55], [12, 56], [20, 54], [23, 48], [28, 46], [29, 42], [36, 42], [37, 37], [36, 33], [32, 32], [30, 30], [36, 28], [42, 26], [48, 24], [54, 22], [60, 18], [68, 22], [70, 30], [65, 35], [60, 38], [60, 42], [52, 42], [50, 40], [46, 42], [44, 45], [40, 43], [36, 42], [30, 40], [25, 40], [22, 42], [18, 44], [15, 44], [10, 46], [6, 44], [4, 46], [0, 44], [-6, 44], [-9, 38], [-9, 36]]],
                },
              },
            ],
          },
        },
        {
          id: "byzantine-565",
          label: "Byzantine Empire under Justinian (565 CE)",
          year: 565,
          visible: false,
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { name: "Byzantine Empire", period: "565 CE", fillColor: "#aade87" },
                geometry: {
                  type: "Polygon",
                  coordinates: [[[6, 36], [8, 38], [4, 40], [4, 44], [0, 44], [-2, 42], [-6, 44], [-9, 38], [-6, 36], [-6, 32], [-2, 30], [2, 30], [6, 32], [10, 34], [14, 36], [16, 40], [20, 42], [24, 42], [28, 40], [30, 36], [36, 38], [36, 42], [32, 44], [28, 46], [24, 46], [20, 48], [22, 44], [24, 42], [28, 40], [30, 36], [30, 34], [32, 32], [36, 30], [36, 28], [40, 26], [42, 22], [42, 18], [36, 16], [30, 18], [24, 20], [20, 22], [16, 24], [14, 28], [10, 30], [6, 32], [6, 36]]],
                },
              },
            ],
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "ancient-cities-interactive",
      title: "Map of Ancient Cities & Archaeological Sites",
      description: "Discover ancient cities and archaeological sites from the Greco-Roman world. Click markers to learn about each location's history and significance.",
      content: "This interactive map features notable ancient cities and archaeological sites across the Mediterranean world, from the Greek colonies of Magna Graecia to the far reaches of the Roman Empire.\n\n**Featured Sites:** Major cities are marked with popups containing historical information. Zoom in to explore specific regions.",
      region: "Europe / Mediterranean",
      era: "Classical",
      type: "interactive",
      centerLat: 37.5,
      centerLng: 22,
      zoom: 5,
      markers: [
        { lat: 37.9715, lng: 23.7257, title: "Athens", description: "Birthplace of democracy and center of classical Greek civilization", type: "city" },
        { lat: 37.9375, lng: 22.8664, title: "Corinth", description: "Major Greek city-state controlling the isthmus between the Peloponnese and mainland", type: "city" },
        { lat: 37.4156, lng: 25.3465, title: "Delos", description: "Sacred island, birthplace of Apollo and Artemis, major trading center", type: "site" },
        { lat: 39.6017, lng: 22.4242, title: "Larissa", description: "Major city of Thessaly, important in the Peloponnesian War", type: "city" },
        { lat: 40.6266, lng: 22.9483, title: "Thessaloniki", description: "Major Macedonian city, important Roman provincial capital", type: "city" },
        { lat: 41.0624, lng: 23.3338, title: "Amphipolis", description: "Athenian colony, site of important battles", type: "site" },
        { lat: 40.7489, lng: 23.7042, title: "Stageira", description: "Birthplace of Aristotle", type: "site" },
        { lat: 38.4833, lng: 22.5000, title: "Delphi", description: "Site of the famous oracle of Apollo", type: "site" },
        { lat: 37.6358, lng: 21.6250, title: "Olympia", description: "Birthplace of the Olympic Games", type: "site" },
        { lat: 37.4436, lng: 25.3294, title: "Mykonos", description: "Ancient island settlement", type: "site" },
        { lat: 37.6111, lng: 26.1639, title: "Icaria", description: "Island associated with the Icarus myth", type: "site" },
        { lat: 37.7492, lng: 26.9767, title: "Samos", description: "Island of Pythagoras and the Heraion", type: "site" },
        { lat: 37.8900, lng: 27.3100, title: "Ephesus", description: "Major Ionian Greek city, site of the Temple of Artemis", type: "city" },
        { lat: 37.7061, lng: 28.0273, title: "Priene", description: "Hellenistic city with well-preserved grid plan", type: "site" },
        { lat: 37.6600, lng: 27.3000, title: "Miletus", description: "Important Ionian city and birthplace of several philosophers", type: "city" },
        { lat: 37.7500, lng: 27.4000, title: "Magnesia", description: "Major Hellenistic city on the Maeander", type: "city" },
        { lat: 36.8333, lng: 28.6000, title: "Caunus", description: "Carian city with a well-preserved rock-cut temple", type: "site" },
        { lat: 36.8333, lng: 30.3333, title: "Phaselis", description: "Lycian city with three harbors", type: "site" },
        { lat: 36.5667, lng: 30.5500, title: "Olympus", description: "Lycian city important in the Hellenistic period", type: "site" },
        { lat: 36.2667, lng: 29.3833, title: "Myra", description: "Lycian city with rock-cut tombs", type: "site" },
      ],
      timeline: [
        { year: -776, event: "First Olympic Games", description: "The traditional date for the first Olympic Games held at Olympia in honor of Zeus.", category: "culture" },
        { year: -508, event: "Cleisthenes establishes democracy in Athens", description: "Cleisthenes reforms the Athenian constitution, establishing the world's first known democracy.", category: "politics" },
        { year: -490, event: "Battle of Marathon", description: "Athenian forces defeat the Persians in a stunning victory, preserving Greek independence.", category: "war" },
        { year: -480, event: "Battle of Thermopylae", description: "King Leonidas and 300 Spartans make a legendary last stand against the invading Persian army.", category: "war" },
        { year: -431, event: "Peloponnesian War begins", description: "Conflict between Athens and Sparta that engulfs the Greek world for nearly three decades.", category: "war" },
        { year: -356, event: "Temple of Artemis at Ephesus destroyed", description: "The temple, one of the Seven Wonders of the Ancient World, is burned down by Herostratus.", category: "disaster" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "prehistoric-sites-interactive",
      title: "Map of Prehistoric Sites",
      description: "Explore the locations of significant prehistoric archaeological sites around the world, from the earliest hominid remains to the dawn of civilization.",
      content: "This map showcases important prehistoric sites spanning millions of years of human evolution and early civilization, from the earliest stone tools to the first cities.\n\n**Key Sites:** Click on markers to learn more about each prehistoric location.",
      region: "Worldwide",
      era: "Prehistory",
      type: "interactive",
      centerLat: 30,
      centerLng: 10,
      zoom: 2,
      markers: [
        { lat: -3.2333, lng: 35.5833, title: "Olduvai Gorge", description: "Site of some of the earliest hominid remains", type: "site" },
        { lat: 6.1000, lng: 35.4667, title: "Konso", description: "Early hominid site with stone tools dating to 1.4 million years", type: "site" },
        { lat: -2.3333, lng: 34.8333, title: "Laetoli", description: "Famous for 3.6 million-year-old hominid footprints", type: "site" },
        { lat: 43.6590, lng: 3.4310, title: "Lascaux", description: "Famous cave with Paleolithic paintings dated to 17,000 BCE", type: "site" },
        { lat: 44.9392, lng: 0.9117, title: "Les Eyzies", description: "Major Paleolithic site with numerous cave dwellings", type: "site" },
        { lat: 51.7181, lng: -0.2351, title: "St Albans", description: "Multi-period site from Neolithic to Roman occupation", type: "site" },
        { lat: 51.1789, lng: -1.8262, title: "Stonehenge", description: "Neolithic henge monument dating to 3000-2000 BCE", type: "site" },
        { lat: 53.3333, lng: -6.2500, title: "Newgrange", description: "Passage tomb from the Neolithic period, 3200 BCE", type: "site" },
        { lat: 37.1833, lng: -1.8167, title: "Cueva de los Murciélagos", description: "Iberian cave with Neolithic artifacts", type: "site" },
        { lat: 38.0333, lng: 23.9000, title: "Franchthi Cave", description: "Cave with continuous occupation from 20,000 BCE", type: "site" },
        { lat: 32.1833, lng: 35.7000, title: "Ain Ghazal", description: "Major Neolithic settlement with large human figurines", type: "site" },
        { lat: 32.5000, lng: 35.1667, title: "Yarmouk", description: "Early Neolithic settlement, 6400 BCE", type: "site" },
        { lat: 32.2333, lng: 35.2833, title: "Tell es-Sultan (Jericho)", description: "One of the oldest continuously inhabited cities in the world", type: "city" },
        { lat: 37.9000, lng: 40.6000, title: "Göbekli Tepe", description: "Massive ritual complex from 9600 BCE, oldest known temple", type: "site" },
        { lat: 37.9500, lng: 43.3167, title: "Çatalhöyük", description: "Large Neolithic settlement dated to 7500 BCE", type: "site" },
        { lat: 38.0000, lng: 33.5000, title: "Asıklı Höyük", description: "Early Neolithic settlement in Anatolia", type: "site" },
        { lat: 42.0000, lng: 20.5000, title: "Vlasac", description: "Mesolithic settlement in the Iron Gates region", type: "site" },
        { lat: 25.0000, lng: 67.0000, title: "Mohenjo-daro", description: "Major city of the Indus Valley Civilization (2600 BCE)", type: "city" },
        { lat: 30.8333, lng: 72.0000, title: "Harappa", description: "Type site of the Indus Valley Civilization", type: "city" },
        { lat: 27.1667, lng: 112.4333, title: "Peking Man Site (Zhoukoudian)", description: "Cave with Homo erectus remains dating to 780,000 BP", type: "site" },
        { lat: 38.2167, lng: 112.3167, title: "Dingcun", description: "Site with early Paleolithic stone tools", type: "site" },
        { lat: 27.0000, lng: 107.0000, title: "Ziyang", description: "Site of early Homo sapiens remains in China", type: "site" },
      ],
      timeline: [
        { year: -200000, event: "Earliest Homo sapiens appear", description: "Anatomically modern humans appear in Africa.", category: "science" },
        { year: -50000, event: "Human migration out of Africa", description: "Modern humans spread across Asia, Europe, and Australia.", category: "discovery" },
        { year: -30000, event: "Cave paintings in Europe", description: "Paleolithic cave paintings flourish in Europe, including the famous Lascaux and Chauvet caves.", category: "culture" },
        { year: -9600, event: "Construction of Göbekli Tepe", description: "Massive ritual complex constructed in Anatolia, considered the oldest known temple.", category: "culture" },
        { year: -7500, event: "Çatalhöyük settlement flourishes", description: "Large Neolithic settlement in Anatolia, one of the world's earliest urban centers.", category: "culture" },
        { year: -3200, event: "Construction of Newgrange", description: "The passage tomb at Newgrange in Ireland is constructed with alignment to the winter solstice.", category: "culture" },
        { year: -3000, event: "Stonehenge construction begins", description: "The first stage of Stonehenge is built, beginning a 1,500-year construction process.", category: "culture" },
        { year: -2600, event: "Indus Valley Civilization at peak", description: "Mohenjo-daro and Harappa represent sophisticated urban planning and trade networks.", category: "science" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "history-museums-interactive",
      title: "Map of History & Archaeology Museums",
      description: "Find major archaeological and history museums around the world, home to artifacts spanning from prehistory to the modern era.",
      content: "This interactive map shows the locations of major museums dedicated to history and archaeology. Plan your visits and discover the world's greatest collections.",
      region: "Worldwide",
      era: "All",
      type: "interactive",
      centerLat: 30,
      centerLng: 0,
      zoom: 2,
      markers: [
        { lat: 48.8606, lng: 2.3376, title: "Louvre Museum", description: "Paris, France — World's largest museum, home to the Mona Lisa", type: "museum" },
        { lat: 51.5194, lng: -0.1270, title: "British Museum", description: "London, UK — Extensive collection of world art and artifacts", type: "museum" },
        { lat: 52.5200, lng: 13.4050, title: "Neues Museum", description: "Berlin, Germany — Egyptian and prehistoric collections", type: "museum" },
        { lat: 41.8986, lng: 12.4769, title: "Capitoline Museums", description: "Rome, Italy — Oldest public museum in the world", type: "museum" },
        { lat: 37.9686, lng: 23.7294, title: "Acropolis Museum", description: "Athens, Greece — Artifacts from the Acropolis", type: "museum" },
        { lat: 37.9686, lng: 23.7325, title: "National Archaeological Museum", description: "Athens, Greece — Largest archaeological museum in Greece", type: "museum" },
        { lat: 40.7532, lng: -73.9822, title: "Metropolitan Museum of Art", description: "New York, USA — Comprehensive collection spanning 5,000 years", type: "museum" },
        { lat: 38.8977, lng: -77.0365, title: "Smithsonian National Museum of Natural History", description: "Washington DC, USA — Extensive natural and cultural history collections", type: "museum" },
        { lat: 30.0444, lng: 31.2357, title: "The Egyptian Museum", description: "Cairo, Egypt — World's most extensive collection of Ancient Egyptian artifacts", type: "museum" },
        { lat: 41.0082, lng: 28.9784, title: "Istanbul Archaeological Museums", description: "Istanbul, Turkey — Collection spanning the region's ancient history", type: "museum" },
        { lat: 42.3601, lng: -71.0589, title: "Museum of Fine Arts", description: "Boston, USA — Extensive art and artifact collection", type: "museum" },
        { lat: 35.6762, lng: 139.7765, title: "Tokyo National Museum", description: "Tokyo, Japan — Largest art museum in Japan", type: "museum" },
        { lat: 28.6139, lng: 77.2090, title: "National Museum", description: "New Delhi, India — Comprehensive collection of Indian art and artifacts", type: "museum" },
        { lat: -33.8688, lng: 151.2093, title: "Australian Museum", description: "Sydney, Australia — Natural history and anthropology", type: "museum" },
        { lat: -22.9068, lng: -43.1729, title: "National Museum of Brazil", description: "Rio de Janeiro, Brazil — Natural history and anthropology", type: "museum" },
      ],
      timeline: [
        { year: -25000, event: "Venus figurines created", description: "Some of the earliest known sculptures, the Venus figurines, are created across Europe.", category: "culture" },
        { year: 1471, event: "Vatican Museums founded by Pope Sixtus IV", description: "The Vatican Museums trace their origin to the donation of a collection of bronze sculptures by Pope Sixtus IV.", category: "culture" },
        { year: 1641, event: "Capitoline Museums opened to the public", description: "The Capitoline Museums in Rome become the first public museum in the world, founded by Pope Sixtus IV.", category: "culture" },
        { year: 1753, event: "British Museum founded", description: "The British Museum is established by an act of Parliament based on the collections of Sir Hans Sloane.", category: "culture" },
        { year: 1793, event: "Louvre Museum opens to the public", description: "The Louvre opens as a public museum, displaying the royal collections of France.", category: "culture" },
        { year: 1855, event: "Neues Museum opens in Berlin", description: "The Neues Museum opens, housing Egyptian and prehistoric collections.", category: "culture" },
        { year: 1886, event: "Metropolitan Museum of Art opens", description: "The Met opens in New York City, becoming the largest art museum in the Americas.", category: "culture" },
        { year: 1900, event: "Egyptian Museum in Cairo established", description: "The Egyptian Museum in Cairo is established, becoming home to the world's most extensive collection of pharaonic antiquities.", category: "culture" },
        { year: 2009, event: "Acropolis Museum opens in Athens", description: "The new Acropolis Museum opens, housing artifacts from the Acropolis of Athens.", category: "culture" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "ancient-mediterranean-interactive",
      title: "Map of the Ancient Mediterranean Civilizations",
      description: "Explore the great civilizations of the ancient Mediterranean — Greece, Carthage, Egypt, Persia, and Rome — with interactive boundaries and key sites.",
      content: "The ancient Mediterranean was a crossroads of civilizations, from the pharaohs of Egypt to the city-states of Greece, the empire of Carthage, and the legions of Rome.\n\n**Civilizations Featured:**\n- **Ancient Greece** — The birthplace of democracy, philosophy, and Western art\n- **Carthaginian Empire** — The great maritime power that challenged Rome\n- **Persian Empire** — The largest empire of the ancient world\n- **Hellenistic Kingdoms** — The successor states of Alexander's empire\n\nClick markers for information about major cities and historical sites.",
      region: "Mediterranean",
      era: "Ancient",
      type: "interactive",
      centerLat: 34,
      centerLng: 22,
      zoom: 4,
      markers: [
        { lat: 31.2001, lng: 29.9187, title: "Alexandria", description: "Capital of Ptolemaic Egypt, site of the great library", type: "city" },
        { lat: 29.9792, lng: 31.1342, title: "Giza", description: "Site of the Great Pyramids and Sphinx", type: "city" },
        { lat: 36.8529, lng: 10.3232, title: "Carthage", description: "Capital of the Carthaginian Empire", type: "city" },
        { lat: 30.0444, lng: 31.2357, title: "Cairo (Fustat)", description: "Historic city near ancient Memphis", type: "city" },
        { lat: 34.0000, lng: 36.0000, title: "Heliopolis", description: "Major ancient Egyptian religious center", type: "site" },
        { lat: 37.5000, lng: 27.0000, title: "Miletus", description: "Birthplace of philosophy and geographical thought", type: "city" },
        { lat: 36.5000, lng: 31.0000, title: "Side", description: "Major Pamphylian port city with Roman ruins", type: "site" },
        { lat: 35.0000, lng: 36.0000, title: "Apamea", description: "Major Seleucid city", type: "city" },
        { lat: 32.5000, lng: 35.0000, title: "Samaria", description: "Historical region and city in the Levant", type: "site" },
      ],
      timeline: [
        { year: -3000, event: "Rise of Ancient Egypt", description: "The unification of Upper and Lower Egypt marks the beginning of one of history's greatest civilizations.", category: "politics" },
        { year: -800, event: "Founding of Carthage", description: "Phoenician settlers from Tyre establish Carthage, which grows to become the dominant power in the western Mediterranean.", category: "politics" },
        { year: -500, event: "Golden Age of Greece", description: "Athens and other Greek city-states flourish, producing enduring contributions to philosophy, art, and democracy.", category: "culture" },
        { year: -336, event: "Alexander the Great conquers Persia", description: "Alexander of Macedon defeats the Persian Empire, spreading Greek culture across the known world.", category: "war" },
        { year: -146, event: "Rome destroys Carthage", description: "Roman forces under Scipio Aemilianus besiege and destroy Carthage, ending the Punic Wars.", category: "war" },
        { year: -31, event: "Battle of Actium", description: "Octavian defeats Mark Antony and Cleopatra, ending the Hellenistic period and establishing Roman dominance.", category: "war" },
      ],
      layers: [
        {
          id: "mediterranean-ancient",
          label: "Ancient Mediterranean Civilizations",
          visible: true,
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { name: "Ancient Mediterranean World", fillColor: "#f0e68c" },
                geometry: {
                  type: "Polygon",
                  coordinates: [[[-10, 36], [-10, 46], [0, 46], [5, 44], [10, 46], [15, 44], [20, 42], [25, 42], [30, 42], [35, 38], [40, 36], [42, 32], [38, 30], [32, 30], [28, 32], [24, 32], [20, 34], [15, 34], [12, 32], [10, 36], [5, 36], [0, 36], [-5, 36], [-10, 36]]],
                },
              },
            ],
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  await MapEntryModel.insertMany(interactiveMaps);
}

// ── Chat ──────────────────────────────────────────────────────────────────

const messageSchema = new Schema({
  id: { type: String, required: true },
  conversationId: { type: String, required: true, index: true },
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, required: true },
  createdAt: { type: String, required: true },
});

const conversationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

const ConversationModel = mongoose.model("Conversation", conversationSchema);
const MessageModel = mongoose.model("Message", messageSchema);

export { ConversationModel, MessageModel };

export async function createConversation(id: string, title: string): Promise<{ id: string; title: string; createdAt: string; updatedAt: string }> {
  const now = new Date().toISOString();
  await ConversationModel.create({ id, title, createdAt: now, updatedAt: now });
  return { id, title, createdAt: now, updatedAt: now };
}

export async function listConversations(): Promise<Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }>> {
  const convs = await ConversationModel.find().sort({ updatedAt: -1 }).lean();
  return await Promise.all(convs.map(async (c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: await MessageModel.countDocuments({ conversationId: c.id }),
  })));
}

export async function getConversation(id: string): Promise<{ id: string; title: string; createdAt: string; updatedAt: string } | null> {
  const c = await ConversationModel.findOne({ id }).lean();
  if (!c) return null;
  return { id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt };
}

export async function addMessage(id: string, conversationId: string, role: string, content: string, blocks?: any[]): Promise<{ id: string; conversationId: string; role: string; content: string; blocks?: any[]; createdAt: string }> {
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = { id, conversationId, role, content, createdAt: now };
  if (blocks) doc.blocks = blocks;
  await MessageModel.create(doc);
  await ConversationModel.updateOne({ id: conversationId }, { $set: { updatedAt: now } });
  return { id, conversationId, role, content, blocks, createdAt: now };
}

export async function getMessages(conversationId: string): Promise<Array<{ id: string; conversationId: string; role: string; content: string; blocks?: any[]; createdAt: string }>> {
  const msgs = await MessageModel.find({ conversationId }).sort({ createdAt: 1 }).lean();
  return msgs.map((m) => {
    const doc = m as Record<string, unknown>;
    return {
      id: doc.id as string,
      conversationId: doc.conversationId as string,
      role: doc.role as string,
      content: doc.content as string,
      blocks: doc.blocks as any[] | undefined,
      createdAt: doc.createdAt as string,
    };
  });
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  await ConversationModel.updateOne({ id }, { $set: { title } });
}

// ── Default Scenes ─────────────────────────────────────────────────────────

function createDefaultRomeScene(): ThreeDMapScene {
  return {
    id: "scene-roman-empire",
    title: "Ancient Rome — City Center",
    centerLat: 41.89,
    centerLng: 12.49,
    zoom: 14,
    terrain: { type: "hills", color: "#8a9a6a", heightScale: 1.0 },
    buildings: [
      { id: "colosseum", lat: 41.8902, lng: 12.4922, width: 50, depth: 40, height: 30, color: "#d4c9b3", label: "Colosseum", type: "other" as const },
      { id: "roman-forum", lat: 41.8925, lng: 12.4853, width: 80, depth: 50, height: 8, color: "#d4c9b3", label: "Roman Forum", type: "forum" as const },
      { id: "palatine-hill", lat: 41.888, lng: 12.486, width: 60, depth: 40, height: 12, color: "#c4753a", label: "Palatine Hill", type: "palace" as const },
      { id: "pantheon", lat: 41.8986, lng: 12.4769, width: 30, depth: 30, height: 25, color: "#e8d4a8", label: "Pantheon", type: "temple" as const },
      { id: "circus-maximus", lat: 41.885, lng: 12.485, width: 100, depth: 20, height: 5, color: "#b8a88a", label: "Circus Maximus", type: "other" as const },
      { id: "temple-jupiter", lat: 41.8919, lng: 12.4812, width: 25, depth: 20, height: 20, color: "#e8d4a8", label: "Temple of Jupiter", type: "temple" as const },
      { id: "curia", lat: 41.8929, lng: 12.4857, width: 15, depth: 25, height: 12, color: "#d4c9b3", label: "Curia (Senate House)", type: "forum" as const },
      { id: "basilica-constant", lat: 41.893, lng: 12.487, width: 40, depth: 30, height: 18, color: "#d4c9b3", label: "Basilica of Constantine", type: "forum" as const },
      { id: "trajans-market", lat: 41.895, lng: 12.486, width: 35, depth: 25, height: 15, color: "#c4753a", label: "Trajan's Market", type: "other" as const },
      { id: "aqueduct-claudia", lat: 41.885, lng: 12.495, width: 80, depth: 4, height: 10, color: "#9ab0b8", label: "Aqua Claudia", type: "aqueduct" as const },
      { id: "mausoleum-augustus", lat: 41.906, lng: 12.476, width: 30, depth: 30, height: 15, color: "#b8a88a", label: "Mausoleum of Augustus", type: "other" as const },
      { id: "theater-marcellus", lat: 41.8915, lng: 12.479, width: 35, depth: 30, height: 15, color: "#d4c9b3", label: "Theater of Marcellus", type: "other" as const },
    ],
    annotations: [
      { lat: 41.8902, lng: 12.4922, label: "Colosseum", description: "Completed in 80 CE, the Flavian Amphitheater could hold 50,000 spectators for gladiatorial contests and public spectacles.", articleSlug: "colosseum" },
      { lat: 41.8925, lng: 12.4853, label: "Roman Forum", description: "The political, religious, and commercial center of ancient Rome for over a millennium.", articleSlug: "roman-forum" },
      { lat: 41.8986, lng: 12.4769, label: "Pantheon", description: "A temple to all gods, completed c. 126 CE under Hadrian, featuring the world's largest unreinforced concrete dome.", articleSlug: "pantheon" },
      { lat: 41.888, lng: 12.486, label: "Palatine Hill", description: "The centermost of Rome's seven hills, site of imperial palaces and the legendary birthplace of the city.", articleSlug: "palatine-hill" },
    ],
  };
}

// ── Analytics ────────────────────────────────────────────────────────────

export async function trackArticleView(slug: string, ip?: string, event = "view"): Promise<void> {
  await ArticleViewModel.create({ slug, event, ip: ip || null });
}

export async function getArticleViewCount(slug: string): Promise<number> {
  return await ArticleViewModel.countDocuments({ slug });
}

export async function getTopArticles(limit = 10): Promise<Array<{ slug: string; title: string; views: number }>> {
  return await ArticleViewModel.aggregate([
    { $group: { _id: "$slug", views: { $sum: 1 } } },
    { $lookup: { from: "articles", localField: "_id", foreignField: "slug", as: "article" } },
    { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
    { $project: { slug: "$_id", title: "$article.title", views: 1, _id: 0 } },
    { $sort: { views: -1 } },
    { $limit: limit },
  ]);
}

// ── Queue Persistence ─────────────────────────────────────────────────────

export async function saveJob(slug: string, status: string, info: { phase?: string; error?: string; meta?: Record<string, string> }): Promise<void> {
  const now = new Date().toISOString();
  const existing = await JobModel.findOne({ slug });
  if (existing) {
    const update: Record<string, unknown> = { status, updatedAt: now };
    if (info.phase) update.phase = info.phase;
    if (info.error !== undefined) update.error = info.error;
    if (info.meta) update.meta = info.meta;
    await JobModel.updateOne({ slug }, { $set: update });
  } else {
    await JobModel.create({
      slug,
      title: slug.replace(/-/g, " "),
      status,
      phase: info.phase || "pending",
      createdAt: now,
      updatedAt: now,
      error: info.error,
      meta: info.meta,
    });
  }
}

export async function loadAllJobs(): Promise<Array<{ slug: string; status: string; phase: string; createdAt: string; error?: string; meta?: Record<string, string> }>> {
  const docs = await JobModel.find({
    status: { $nin: ["done", "error"] },
  }).sort({ createdAt: -1 }).lean();
  return docs.map((d) => {
    const doc = d as Record<string, unknown>;
    return {
      slug: doc.slug as string,
      status: doc.status as string,
      phase: (doc.phase as string) || "pending",
      createdAt: doc.createdAt as string,
      error: doc.error as string | undefined,
      meta: doc.meta as Record<string, string> | undefined,
    };
  });
}

export async function deleteJobDoc(slug: string): Promise<boolean> {
  const r = await JobModel.deleteOne({ slug });
  return r.deletedCount > 0;
}
