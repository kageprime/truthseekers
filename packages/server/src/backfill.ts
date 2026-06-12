import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { ArticleModel } from "@encarta/storage";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MOONGOSE_CONNECTION_STRING || "mongodb://localhost:27017/encarta";
const MODEL_ACCESS_KEY = process.env.MODEL_ACCESS_KEY || "";
const DO_AI_URL = process.env.DO_AI_URL || "https://inference.do-ai.run/v1/images/generations";
const IMAGE_DIR = process.env.ENCARTA_IMAGE_DIR || path.resolve(__dirname, "..", "..", "..", "public", "images");

interface DOAIResponse {
  created: number;
  data: Array<{ b64_json: string }>;
}

async function generateAndSave(prompt: string, id: string): Promise<string | null> {
  try {
    const response = await fetch(DO_AI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MODEL_ACCESS_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "stable-diffusion-3.5-large", prompt, n: 1, size: "1024x1024", quality: "auto", response_format: "b64_json", output_format: "png" }),
    });
    if (!response.ok) { const t = await response.text(); console.error(`  FAIL (${response.status}): ${t}`); return null; }
    const data: DOAIResponse = await response.json() as DOAIResponse;
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;
    try { await fs.promises.access(IMAGE_DIR); } catch { await fs.promises.mkdir(IMAGE_DIR, { recursive: true }); }
    await fs.promises.writeFile(path.join(IMAGE_DIR, `${id}.png`), Buffer.from(b64, "base64"));
    return `/images/${id}.png`;
  } catch (error) { console.error("  FAIL:", error); return null; }
}

async function backfill() {
  if (!MODEL_ACCESS_KEY) { console.log("No MODEL_ACCESS_KEY — skipping."); return; }

  await mongoose.connect(MONGODB_URI);
  const articles = await ArticleModel.find({}).lean();
  console.log(`Found ${articles.length} articles.\n`);

  let generated = 0;
  let skipped = 0;

  for (const article of articles) {
    const a = article as unknown as Record<string, unknown>;
    const sections = a.sections as Array<Record<string, unknown>> | undefined;
    if (!sections) continue;

    // Generate at most 2 images per article: first image in first section, first in second section
    for (let si = 0; si < Math.min(sections.length, 2); si++) {
      const media = sections[si].media as Array<Record<string, unknown>> | undefined;
      if (!media) continue;

      const pending = media.find((m) => m.type === "image" && !m.src && m.prompt);
      if (!pending) { skipped++; continue; }

      const id = (pending.id as string) || `backfill-${a.slug}-${si}`;
      console.log(`[${a.slug}] sec ${si}: generating...`);
      const url = await generateAndSave(pending.prompt as string, id);
      if (url) {
        pending.src = url;
        await ArticleModel.updateOne({ slug: a.slug }, { $set: { sections } });
        console.log(`  → ${url}`);
        generated++;
      }
      // rate limit
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped/already have src.`);
  await mongoose.disconnect();
}

backfill().catch((err) => { console.error(err); process.exit(1); });
