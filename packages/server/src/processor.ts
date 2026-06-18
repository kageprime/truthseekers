import { queue, articleToBlocks, runPipeline } from "@encarta/core";
import type { Article } from "@encarta/core";
import { upsertArticle, commitArticle, indexArticle } from "@encarta/storage";

export async function processArticle(slug: string, meta?: Record<string, string>): Promise<void> {
  const persona = (meta?.persona || "veritas") as import("@encarta/core").Persona;

  const onAgentEvent = (event: import("@encarta/core").AgentEvent) => {
    queue.emitAgentEvent(slug, event);
  };

  try {
    queue.updateJob(slug, "researching", { phase: "research" });

    // Use the unified Agent-based pipeline
    const content = await runPipeline(slug, persona, onAgentEvent);

    if (!Array.isArray(content.sections)) {
      console.error(`[processArticle] Invalid content for "${slug}": sections missing`);
      content.sections = [];
    }

    queue.updateJob(slug, "media", { phase: "generating-images" });

    const imageItems: { prompt: string; id: string; caption?: string }[] = [];
    for (const section of content.sections) {
      for (const media of section.media || []) {
        if (media.type === "image" && media.prompt) {
          imageItems.push({ prompt: media.prompt, id: media.id, caption: media.caption });
        }
      }
    }

    if (imageItems.length > 0) {
      const { generateImagesBatch } = await import("./imageGen.js");
      const generated = await generateImagesBatch(imageItems);
      for (const gen of generated) {
        for (const section of content.sections ?? []) {
          for (const media of section.media ?? []) {
            if (media.id === gen.id) { media.src = gen.url; }
          }
        }
      }
    }

    queue.updateJob(slug, "storing", { phase: "store" });
    const now = new Date().toISOString();
    const blocks = articleToBlocks(
      slug, content.title ?? slug, content.abstract ?? "",
      content.sections ?? [], content.timeline ?? [],
      content.crossrefs ?? [], content.citations ?? [],
    );
    const article: Article = {
      slug, title: content.title ?? slug, abstract: content.abstract ?? "",
      sections: content.sections ?? [], timeline: content.timeline ?? [],
      categories: content.categories ?? [], crossrefs: content.crossrefs ?? [],
      citations: content.citations ?? [], threedScenes: content.threedScenes ?? [],
      blocks,
      metadata: {
        version: 1, created: now, updated: now, status: "published", freshness: now,
        generatedBy: meta?.generatedBy || undefined,
      },
    };

    await upsertArticle(article);
    await commitArticle(article);
    
    // Explicitly generate and store embeddings if needed
    const fullText = [
      article.title,
      article.abstract,
      ...article.sections.map(s => `${s.title}\n${s.content}`)
    ].join("\n\n");
    await indexArticle(slug, fullText);
    
    queue.updateJob(slug, "done", { phase: "complete" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[processArticle] Error generating "${slug}": ${errorMsg}`);
    queue.updateJob(slug, "error", { phase: "error", error: errorMsg });
    throw error;
  }
}
