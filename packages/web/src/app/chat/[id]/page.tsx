"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const _ = use(params);
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
