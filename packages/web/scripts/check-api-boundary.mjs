#!/usr/bin/env node
/**
 * API-layer import boundary guard.
 *
 * Enforces the project rule: page/component code must fetch data through the
 * React Query hooks layer (`src/app/hooks/**`) and must NOT import the raw API
 * client (`@/lib/api`) directly. This keeps the "queries use hooks" convention
 * from silently regressing.
 *
 * Allowed to import from `@/lib/api` at runtime:
 *   - src/app/hooks/**            (the hooks layer — the sanctioned facade)
 *   - src/app/components/AuthProvider.tsx  (auth bootstrap root)
 *
 * `import type ... from "@/lib/api"` is always allowed (type-only, no runtime
 * call; e.g. ClaimGraph / ClaimGraphViewer / GraphView pick up graph types).
 * Importing `@/lib/constants` (BASE) for building asset/OAuth URLs is allowed.
 *
 * Run via: npm run lint   (also folded into `npm run typecheck`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const ROOT = fileURLToPath(new URL("../src", import.meta.url));
const API_SPECIFIER = /(?:@\/|\.?\.?\/)*lib\/api/;
const IMPORT_RE = /import\s+(type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/gm;

const ALLOWED = [
  (p) => p.split(sep).includes("hooks"),
  (p) => p.endsWith(`${sep}AuthProvider.tsx`),
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function allowedFile(abs) {
  return ALLOWED.some((pred) => pred(abs));
}

let violations = 0;
const files = walk(ROOT);

for (const file of files) {
  if (allowedFile(file)) continue;
  const src = readFileSync(file, "utf8");
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const isTypeOnly = m[1] !== undefined; // captured "type "
    const spec = m[2];
    if (!isTypeOnly && API_SPECIFIER.test(spec)) {
      console.error(
        `[api-boundary] forbidden direct API import in ${relative(ROOT, file)}:\n` +
        `    import ... from "${spec}"\n` +
        `    → route through src/app/hooks (e.g. useArticle, useQueue, useArticleProgress) instead.`
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n❌ api-boundary: ${violations} violation(s).`);
  process.exit(1);
}
console.log("✓ api-boundary: no direct @/lib/api imports outside the hooks layer.");
