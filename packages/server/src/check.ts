import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { ArticleModel, MapEntryModel } from "@encarta/storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
config();

async function check() {
  const uri = process.env.MONGODB_URI || process.env.MOONGOSE_CONNECTION_STRING || "mongodb://localhost:27017/encarta";
  console.log("Connecting...");
  await mongoose.connect(uri);

  const articleCount = await ArticleModel.countDocuments();
  const mapCount = await MapEntryModel.countDocuments();

  console.log(`\nArticles: ${articleCount}`);
  const articles = await ArticleModel.find({}, { slug: 1, title: 1, "metadata.status": 1 }).lean();
  for (const a of articles) {
    const art = a as unknown as Record<string, unknown>;
    console.log(`  ${art.slug}: ${art.title} (${(art.metadata as Record<string, unknown>)?.status || "?"})`);
  }

  console.log(`\nMaps: ${mapCount}`);
  const maps = await MapEntryModel.find({}, { slug: 1, title: 1, type: 1 }).lean();
  for (const m of maps) {
    const map = m as unknown as Record<string, unknown>;
    console.log(`  ${map.slug}: ${map.title} [${map.type}]`);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
