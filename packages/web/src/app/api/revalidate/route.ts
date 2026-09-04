import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "veritas-dev-revalidate";

export async function POST(req: Request) {
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
  if (body.slug) {
    targets.add(`/article/${body.slug}`);
    targets.add("/");
    targets.add("/contested");
    targets.add("/gaps");
    targets.add("/stale");
    targets.add("/claim-graph");
    targets.add("/sitemap.xml");
  }
  for (const p of body.paths ?? []) {
    targets.add(p);
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
