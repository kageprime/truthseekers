import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Database from "better-sqlite3";
import { ArticleModel, MapEntryModel } from "@encarta/storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MOONGOSE_CONNECTION_STRING || "mongodb://localhost:27017/encarta";

interface ArticleRow {
  slug: string;
  title: string;
  abstract: string;
  content_json: string;
  metadata_json: string;
  citations_json: string;
  crossrefs_json: string;
  categories_json: string;
  timeline_json: string;
  threed_json: string;
  status: string;
  version: number;
  created: string;
  updated: string;
  freshness: string;
}

interface MapRow {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  content: string;
  image?: string;
  region?: string;
  era?: string;
  type: string;
  external_url?: string;
  center_lat?: number;
  center_lng?: number;
  zoom?: number;
  geo_json?: string;
  markers_json?: string;
  layers_json?: string;
  timeline_json?: string;
  threed_scene_json?: string;
  created: string;
  updated: string;
}

function parseYear(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return n;
    return 0;
  }
  return 0;
}

function rowToArticle(row: ArticleRow) {
  const content = JSON.parse(row.content_json);
  const timeline = (content.timeline || JSON.parse(row.timeline_json || "[]")).map((e: Record<string, unknown>) => ({
    ...e,
    year: parseYear(e.year),
  }));
  return {
    slug: row.slug,
    title: row.title,
    abstract: row.abstract,
    sections: content.sections || [],
    timeline,
    categories: JSON.parse(row.categories_json || "[]"),
    crossrefs: JSON.parse(row.crossrefs_json || "[]"),
    citations: JSON.parse(row.citations_json || "[]"),
    threedScenes: JSON.parse(row.threed_json || "[]"),
    metadata: JSON.parse(row.metadata_json),
  };
}

function rowToMap(row: MapRow) {
  const mapTimeline = row.timeline_json ? (JSON.parse(row.timeline_json) as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    year: parseYear(e.year),
  })) : undefined;
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || undefined,
    description: row.description,
    content: row.content || "",
    image: row.image || undefined,
    region: row.region || undefined,
    era: row.era || undefined,
    type: row.type as "static" | "interactive",
    externalUrl: row.external_url || undefined,
    centerLat: row.center_lat || undefined,
    centerLng: row.center_lng || undefined,
    zoom: row.zoom || 5,
    geoJson: row.geo_json ? JSON.parse(row.geo_json) : undefined,
    markers: row.markers_json ? JSON.parse(row.markers_json) : undefined,
    layers: row.layers_json ? JSON.parse(row.layers_json) : undefined,
    timeline: mapTimeline,
    threedScene: row.threed_scene_json ? JSON.parse(row.threed_scene_json) : undefined,
    createdAt: row.created,
    updatedAt: row.updated,
  };
}

async function migrate() {
  console.log(`Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}`);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.\n");

  // ── Read from SQLite databases ────────────────────────────────────
  const root = path.resolve(__dirname, "..", "..", "..");
  const dbs = [
    { path: path.join(root, "encarta.db"), label: "root" },
    { path: path.join(root, "data", "seed.db"), label: "seed" },
    { path: path.join(root, "data", "encarta.db"), label: "data" },
  ];

  let totalArticles = 0;
  let totalMaps = 0;
  let articleSlugs = new Set<string>();

  for (const dbInfo of dbs) {
    if (!fs.existsSync(dbInfo.path)) {
      console.log(`[${dbInfo.label}] DB not found: ${dbInfo.path}`);
      continue;
    }

    try {
      const d = new Database(dbInfo.path);
      const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
      const tableNames = tables.map((r) => r.name);
      console.log(`\n[${dbInfo.label}] tables: ${tableNames.join(", ")}`);

      // Migrate articles
      if (tableNames.includes("articles")) {
        const rows = d.prepare("SELECT * FROM articles").all() as ArticleRow[];
        console.log(`  articles: ${rows.length}`);

        for (const row of rows) {
          try {
            if (articleSlugs.has(row.slug)) {
              console.log(`    SKIP ${row.slug} (already migrated)`);
              continue;
            }
            const article = rowToArticle(row);
            await ArticleModel.findOneAndUpdate(
              { slug: row.slug },
              { $set: article },
              { upsert: true }
            );
            articleSlugs.add(row.slug);
            totalArticles++;
            process.stdout.write(".");
          } catch (err) {
            console.log(`\n    FAIL ${row.slug}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Migrate maps
      if (tableNames.includes("maps")) {
        const rows = d.prepare("SELECT * FROM maps").all() as MapRow[];
        console.log(`  maps: ${rows.length}`);

        for (const row of rows) {
          try {
            const existing = await MapEntryModel.findOne({ slug: row.slug });
            if (existing) {
              console.log(`    SKIP ${row.slug} (already exists)`);
              continue;
            }
            const mapEntry = rowToMap(row);
            await MapEntryModel.create(mapEntry);
            totalMaps++;
            process.stdout.write("m");
          } catch (err) {
            console.log(`\n    FAIL ${row.slug}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      d.close();
    } catch (err) {
      console.log(`[${dbInfo.label}] Error: ${err}`);
    }
  }

  console.log(`\n\nMigrated ${totalArticles} articles, ${totalMaps} maps.`);

  await mongoose.disconnect();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
