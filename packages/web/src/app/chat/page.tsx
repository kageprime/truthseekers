import { redirect } from "next/navigation";

// Opt out of static prerendering — the parent layout uses useSearchParams()
// which requires a Suspense boundary at the page level.
export const dynamic = "force-dynamic";

export default function ChatPage() {
  redirect("/chat/new");
}
