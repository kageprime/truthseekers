import { redirect } from "next/navigation";

// ponytail: one canonical URL per article — the static showcase now lives at
// /articles/[slug], so the legacy /article route forwards to the reading room.
export default function LegacyArticleRedirect() {
  redirect("/articles");
}
