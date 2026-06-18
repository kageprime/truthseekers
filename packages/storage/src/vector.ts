import { ArticleModel } from "./db.js";
import { embedText } from "@encarta/core";

const ATLAS_SEARCH_ENABLED = process.env.ATLAS_SEARCH_ENABLED === "true";

/**
 * Index an article for search.
 *
 * With MongoDB, no separate index write is needed — articles are
 * automatically indexed via the `$text` index on the `articles`
 * collection (basic) or via the Atlas Search index `articles_fulltext`
 * (when `ATLAS_SEARCH_ENABLED=true`).
 *
 * This function is a no-op retained for API compatibility.
 */
export async function indexArticle(slug: string, contentText: string): Promise<void> {
  if (!ATLAS_SEARCH_ENABLED) {
    try {
      const embedding = await embedText(contentText);
      await ArticleModel.updateOne({ slug }, { $set: { contentEmbedding: embedding } });
    } catch (err) {
      console.warn(`Failed to index explicit embedding for ${slug}`, err);
    }
  }
}

/**
 * Semantic search using Atlas Vector Search with Automated Embeddings.
 *
 * Requires:
 *   - `ATLAS_SEARCH_ENABLED=true`
 *   - An Atlas Vector Search index named `articles_vector` created on
 *     the `articles` collection with Automated Embeddings enabled,
 *     configured to embed the `contentEmbedding` field.
 *
 * Falls back to basic `$text` search if Atlas Vector Search is not
 * configured.
 *
 * To create the Atlas Vector Search index (via Atlas UI or API):
 * ```json
 * {
 *   "name": "articles_vector",
 *   "type": "vectorSearch",
 *   "fields": [{
 *     "type": "vector",
 *     "path": "contentEmbedding",
 *     "numDimensions": 1536,
 *     "similarity": "cosine"
 *   }],
 *   "autoEmbedding": true
 * }
 * ```
 *
 * The `contentEmbedding` field is populated automatically by Atlas
 * Automated Embeddings on document insert/update.
 */
export async function semanticSearch(
  query: string,
  limit = 10
): Promise<{ slug: string; rank: number }[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  if (ATLAS_SEARCH_ENABLED) {
    // Atlas Vector Search with Automated Embeddings
    // queryText causes Atlas to embed the query string on-the-fly
    // Use collection.aggregate with any[] typing since $vectorSearch
    // is an Atlas-specific stage not in Mongoose's PipelineStage types
    const results = await ArticleModel.collection.aggregate([
      {
        $vectorSearch: {
          index: "articles_vector",
          path: "contentEmbedding",
          queryText: query,
          numCandidates: Math.min(limit * 10, 100),
          limit,
        } as any,
      },
      {
        $project: {
          slug: 1,
          rank: { $meta: "vectorSearchScore" },
        },
      },
    ]).toArray();

    return results.map((r: Record<string, unknown>) => ({
      slug: r.slug as string,
      rank: (r.rank as number) || 0,
    }));
  }

  // Fallback: basic $text search
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = await ArticleModel.find(
    { $text: { $search: escaped } },
    { slug: 1 }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .lean();

  return docs.map((d) => ({
    slug: d.slug,
    rank: ((d as unknown as Record<string, unknown>).score as number) || 0,
  }));
}
