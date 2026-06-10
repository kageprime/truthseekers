import { getDb } from "./db.js";

export async function indexArticle(slug: string, contentText: string): Promise<void> {
  // Vector indexing uses sqlite-vec extension (Milestone 4).
  // For now, full-text search via LIKE covers basic search needs.
}

export async function semanticSearch(query: string, limit = 10): Promise<string[]> {
  // Placeholder for sqlite-vec semantic search (Milestone 4).
  return [];
}
