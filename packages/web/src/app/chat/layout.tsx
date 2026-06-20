"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import ChatTour from "../components/ChatTour";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (pathname === "/chat") router.replace("/chat/new");
  }, [pathname, router]);

  useEffect(() => {
    if (searchParams.get("tour") === "true") {
      setShowTour(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  return (
    <Suspense fallback={null}>
      {showTour && <ChatTour onComplete={() => setShowTour(false)} />}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </Suspense>
  );
}
