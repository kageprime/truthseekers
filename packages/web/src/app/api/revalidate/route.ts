import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// ponytail: fail closed (S22) — no default secret. Unset means the route
// always 503s instead of accepting a guessable dev value.
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

// Only these exact paths plus /article/<slug> may be revalidated (S22) —
// arbitrary `paths[]` entries could purge the CDN cache at will.
const STATIC_ALLOWLIST = new Set(["/", "/contested", "/gaps", "/stale", "/claim-graph", "/sitemap.xml"]);
const SLUG_RE = /^[a-z0-9-]+$/;

export async function POST(req: Request) {
  if (!REVALIDATE_SECRET) {
    return NextResponse.json({ error: "revalidation not configured" }, { status: 503 });
  }
  const secret = req.headers.get("x-revalidate-secret");
  if (secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { slug?: string; paths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const targets = new Set<string>();
  if (body.slug && SLUG_RE.test(body.slug)) {
    targets.add(`/article/${body.slug}`);
    for (const p of STATIC_ALLOWLIST) targets.add(p);
  }
  for (const p of body.paths ?? []) {
    if (STATIC_ALLOWLIST.has(p)) targets.add(p);
  }
  if (targets.size === 0) {
    return NextResponse.json({ error: "nothing to revalidate" }, { status: 400 });
  }

  for (const p of targets) {
    try {
      revalidatePath(p);
    } catch (err) {
      console.warn(`[revalidate] failed path=${p}:`, err);
    }
  }

  return NextResponse.json({ revalidated: [...targets] });
}
