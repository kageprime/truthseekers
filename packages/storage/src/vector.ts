import { getDb } from "./db.js";

export async function indexArticle(slug: string, contentText: string): Promise<void> {
  const db = getDb();
  db.prepare(`DELETE FROM article_search WHERE slug = ?`).run(slug);
  db.prepare(
    `INSERT INTO article_search (slug, title, abstract, content_text) VALUES (?, '', '', ?)`
  ).run(slug, contentText);
}

export async function semanticSearch(query: string, limit = 10): Promise<{ slug: string; rank: number }[]> {
  const db = getDb();

  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const ftsQuery = terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");

  const rows = db.prepare(`
    SELECT slug, rank
    FROM article_search
    WHERE article_search MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(ftsQuery, limit) as Array<{ slug: string; rank: number }>;

  return rows;
}
