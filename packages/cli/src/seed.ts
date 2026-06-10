export {};

const serverUrl = process.env.ENCARTA_SERVER_URL || "http://localhost:4097";

const SEED_TOPICS = [
  "quantum-computing", "crispr-gene-editing", "black-holes", "climate-change",
  "artificial-intelligence", "neuroscience", "nuclear-fusion", "mars-exploration",
  "roman-empire", "industrial-revolution", "renaissance", "ancient-egypt", "age-of-exploration",
  "internet-history", "blockchain", "spacex", "electric-vehicles", "semiconductor",
  "amazon-rainforest", "great-barrier-reef", "sahara-desert",
  "impressionism", "jazz-music", "greek-mythology",
  "prime-numbers", "fractals", "game-theory",
  "stoicism", "existentialism",
];

const args = process.argv.slice(2);
const topics = args.length > 0 ? args : SEED_TOPICS;

interface SeedResult {
  status: string;
  slug?: string;
  error?: string;
}

console.log(`Seeding ${topics.length} topics via ${serverUrl}...\n`);

let enqueued = 0;
let skipped = 0;
let failed = 0;

for (const topic of topics) {
  try {
    const res = await fetch(`${serverUrl}/articles/${topic}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "veritas" }),
    });

    if (!res.ok) {
      console.log(`  [FAIL] ${topic} (HTTP ${res.status})`);
      failed++;
      continue;
    }

    const result: SeedResult = await res.json();

    if (result.status === "already_exists") {
      console.log(`  [SKIP] ${topic} (already exists)`);
      skipped++;
    } else if (result.status === "queued") {
      console.log(`  [ENQ]  ${topic}`);
      enqueued++;
    } else {
      console.log(`  [????] ${topic} (${JSON.stringify(result)})`);
      failed++;
    }
  } catch (err) {
    console.log(`  [FAIL] ${topic} (${err instanceof Error ? err.message : String(err)})`);
    failed++;
  }
}

console.log(`\n---`);
console.log(`Enqueued: ${enqueued} | Skipped: ${skipped} | Failed: ${failed} | Total: ${topics.length}`);
console.log(`\nServer is generating up to 3 articles at a time.`);
console.log(`Monitor: ${serverUrl}/queue or watch the web UI.`);
