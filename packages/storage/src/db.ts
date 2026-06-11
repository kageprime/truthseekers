import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Article, ArticleContent, ArticleMetadata } from "@encarta/core";

const DB_PATH = process.env.ENCARTA_DB_PATH || path.join(process.cwd(), "encarta.db");

let db: SqlJsDatabase | null = null;
let dbLoading: Promise<SqlJsDatabase> | null = null;
let lastFileMtime = 0;

function fileExistsAndMtime(): number {
  try {
    return fs.statSync(DB_PATH).mtimeMs;
  } catch {
    return 0;
  }
}

export async function getDb(): Promise<SqlJsDatabase> {
  const currentMtime = fileExistsAndMtime();
  if (db && currentMtime <= lastFileMtime + 100) return db;
  if (dbLoading) return dbLoading;

  // File changed or first load — reload from disk
  if (db) {
    db.close();
    db = null;
  }

  dbLoading = init();
  db = await dbLoading;
  lastFileMtime = fileExistsAndMtime();
  return db;
}

async function init(): Promise<SqlJsDatabase> {
  const require = createRequire(import.meta.url);
  const sqlJsPath = require.resolve("sql.js");
  const sqlJsDir = path.dirname(sqlJsPath);

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlJsDir, file),
  });

  let data: Uint8Array | null = null;
  try {
    if (fs.existsSync(DB_PATH)) {
      data = fs.readFileSync(DB_PATH);
    }
  } catch {
    // file doesn't exist yet
  }

  const database = new SQL.Database(data ? new Uint8Array(data) : undefined);
  initSchema(database);
  return database;
}

function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initSchema(d: SqlJsDatabase): void {
  d.run("PRAGMA journal_mode = WAL");
  d.run("PRAGMA foreign_keys = ON");

  d.run(`
    CREATE TABLE IF NOT EXISTS articles (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      abstract TEXT NOT NULL,
      content_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]',
      crossrefs_json TEXT NOT NULL DEFAULT '[]',
      categories_json TEXT NOT NULL DEFAULT '[]',
      timeline_json TEXT NOT NULL DEFAULT '[]',
      threed_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      created TEXT NOT NULL,
      updated TEXT NOT NULL,
      freshness TEXT NOT NULL
    )
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS article_search (
      slug TEXT PRIMARY KEY,
      title TEXT,
      abstract TEXT,
      content_text TEXT
    )
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      relationship TEXT NOT NULL,
      PRIMARY KEY (source, target)
    )
  `);
}

function flattenContent(content: ArticleContent): string {
  return [
    content.title,
    content.abstract,
    ...content.sections.map((s) => `${s.title} ${s.content}`),
  ].join(" ");
}

export async function upsertArticle(article: Article): Promise<void> {
  await getDb();
  const d = db!;
  const now = new Date().toISOString();

  const existing = getArticle(article.slug);
  const version = existing ? existing.metadata.version + 1 : 1;

  const metadata: ArticleMetadata = {
    ...article.metadata,
    version,
    updated: now,
    freshness: now,
  };

  const contentJson = JSON.stringify({
    title: article.title,
    abstract: article.abstract,
    sections: article.sections,
    timeline: article.timeline,
    categories: article.categories,
    crossrefs: article.crossrefs,
    citations: article.citations,
    threedScenes: article.threedScenes,
  });

  d.run(
    `INSERT OR REPLACE INTO articles
     (slug, title, abstract, content_json, metadata_json, citations_json, crossrefs_json, categories_json, timeline_json, threed_json, status, version, created, updated, freshness)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      article.slug ?? "",
      article.title ?? "",
      article.abstract ?? "",
      contentJson,
      JSON.stringify(metadata),
      JSON.stringify(article.citations ?? []),
      JSON.stringify(article.crossrefs ?? []),
      JSON.stringify(article.categories ?? []),
      JSON.stringify(article.timeline ?? []),
      JSON.stringify(article.threedScenes ?? []),
      metadata.status ?? "draft",
      version,
      existing?.metadata.created ?? now,
      now,
      now,
    ]
  );

  d.run(
    `INSERT OR REPLACE INTO article_search (slug, title, abstract, content_text) VALUES (?, ?, ?, ?)`,
    [article.slug, article.title, article.abstract, flattenContent(article)]
  );

  upsertGraphEdges(article.slug, article.crossrefs);

  saveDb();
}

export function getArticle(slug: string): Article | null {
  if (!db) return null;
  const stmt = db.prepare("SELECT * FROM articles WHERE slug = ?");
  stmt.bind([slug]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  const content = JSON.parse(row.content_json as string) as ArticleContent;
  return {
    slug: row.slug as string,
    title: row.title as string,
    abstract: row.abstract as string,
    sections: content.sections,
    timeline: content.timeline || [],
    categories: JSON.parse(row.categories_json as string),
    crossrefs: JSON.parse(row.crossrefs_json as string),
    citations: JSON.parse(row.citations_json as string),
    threedScenes: JSON.parse(row.threed_json as string),
    metadata: JSON.parse(row.metadata_json as string) as ArticleMetadata,
  };
}

export function getArticleStatus(slug: string): "draft" | "published" | "error" | null {
  if (!db) return null;
  const stmt = db.prepare("SELECT status FROM articles WHERE slug = ?");
  stmt.bind([slug]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();
  return row.status as "draft" | "published" | "error";
}

export function listArticles(
  limit = 50,
  offset = 0
): Pick<Article, "slug" | "title" | "abstract" | "metadata" | "categories">[] {
  if (!db) return [];
  const stmt = db.prepare(
    `SELECT slug, title, abstract, metadata_json, categories_json
     FROM articles
     WHERE status = 'published'
     ORDER BY updated DESC
     LIMIT ? OFFSET ?`
  );
  stmt.bind([limit, offset]);

  const results: Pick<Article, "slug" | "title" | "abstract" | "metadata" | "categories">[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      slug: row.slug as string,
      title: row.title as string,
      abstract: row.abstract as string,
      metadata: JSON.parse(row.metadata_json as string) as ArticleMetadata,
      categories: JSON.parse(row.categories_json as string) as string[],
    });
  }
  stmt.free();
  return results;
}

export function searchArticles(query: string, limit = 20): Pick<Article, "slug" | "title" | "abstract">[] {
  if (!db) return [];

  const stmt = db.prepare(
    `SELECT slug, title, abstract
     FROM article_search
     WHERE title LIKE ? OR abstract LIKE ? OR content_text LIKE ?
     LIMIT ?`
  );

  const like = `%${query}%`;
  stmt.bind([like, like, like, limit]);

  const results: Pick<Article, "slug" | "title" | "abstract">[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      slug: row.slug as string,
      title: row.title as string,
      abstract: row.abstract as string,
    });
  }
  stmt.free();
  return results;
}

export function upsertGraphEdges(
  source: string,
  refs: { id: string; title: string; relationship: string }[]
): void {
  if (!db) return;
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO graph_edges (source, target, relationship) VALUES (?, ?, ?)"
  );

  for (const ref of refs) {
    stmt.bind([source, ref.id, ref.relationship ?? "related"]);
    stmt.step();
    stmt.reset();
  }
  stmt.free();
}

export function getGraphEdges(slug: string): { target: string; relationship: string }[] {
  if (!db) return [];
  const stmt = db.prepare("SELECT target, relationship FROM graph_edges WHERE source = ?");
  stmt.bind([slug]);

  const results: { target: string; relationship: string }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      target: row.target as string,
      relationship: row.relationship as string,
    });
  }
  stmt.free();
  return results;
}

export function getBacklinks(slug: string): { source: string; relationship: string }[] {
  if (!db) return [];
  const stmt = db.prepare("SELECT source, relationship FROM graph_edges WHERE target = ?");
  stmt.bind([slug]);

  const results: { source: string; relationship: string }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      source: row.source as string,
      relationship: row.relationship as string,
    });
  }
  stmt.free();
  return results;
}

export async function initDb(): Promise<SqlJsDatabase> {
  return getDb();
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
