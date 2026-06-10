export {};

const serverUrl = process.env.ENCARTA_SERVER_URL || "http://localhost:4097";

const args = process.argv.slice(2);
const pliny = args.includes("--pliny");
const slug = args.find((a) => !a.startsWith("--"));

if (!slug) {
  console.error("Usage: npm run generate -- <slug> [--pliny]");
  console.error("Example: npm run generate -- quantum-computing");
  console.error("Example: npm run generate -- roman-empire --pliny");
  process.exit(1);
}

interface GenerateResult {
  status: string;
  persona?: string;
  slug?: string;
}

interface ProgressEvent {
  status: string;
  phase?: string;
  error?: string;
}

async function generate(slug: string, persona: string) {
  console.log(`Enqueuing: ${slug} (persona: ${persona}) → ${serverUrl}`);

  const res = await fetch(`${serverUrl}/articles/${slug}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });

  const result: GenerateResult = await res.json();
  console.log(`  Server: ${JSON.stringify(result)}`);

  if (result.status === "already_exists") {
    console.log(`Article "${slug}" already exists.`);
    return;
  }

  if (result.status !== "queued") {
    console.error(`Unexpected status: ${result.status}`);
    process.exit(1);
  }

  console.log("  Waiting for generation...\n");

  const es = new EventSource(`${serverUrl}/articles/${slug}/progress`);

  await new Promise<void>((resolve, reject) => {
    es.addEventListener("progress", (e: Event) => {
      const data: ProgressEvent = JSON.parse((e as MessageEvent).data);
      if (data.status === "done") {
        console.log(`  ✅ Done! View at ${serverUrl}/articles/${slug}`);
        es.close();
        resolve();
      } else if (data.status === "error") {
        console.error(`  ❌ Error: ${data.error}`);
        es.close();
        reject(new Error(data.error || "unknown"));
      } else {
        console.log(`  ⏳ ${data.phase || data.status}`);
      }
    });

    es.onerror = () => {
      es.close();
      reject(new Error("SSE connection lost"));
    };
  });
}

generate(slug, pliny ? "pliny" : "veritas").catch((err) => {
  console.error(`\nFailed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
