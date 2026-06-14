"use client";

import { useRouter } from "next/navigation";
import { createChat } from "@/lib/api";
import PageLayout from "../components/PageLayout";

export default function ChatListPage() {
  const router = useRouter();
  async function handleNew() {
    const conv = await createChat();
    if (conv) router.push(`/chat/${conv.id}`);
  }

  return (
    <PageLayout sidebar noFooter>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">💬</div>
          <h1 className="pixel text-sm mb-3" style={{ color: "var(--ink)" }}>Truthseekers Chat</h1>
          <p className="text-sm leading-relaxed" style={{ color: "#5f6368" }}>
            Ask questions, explore topics, or request full encyclopedia articles.
            Select a conversation from the sidebar or start a new one.
          </p>
          <div className="mt-8">
            <button onClick={handleNew} className="btn-primary btn-lg">+ Start New Chat</button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
