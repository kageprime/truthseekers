"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AgentEvent } from "../components/ProcessViewer";
import { LIVE_SEGMENT_ID } from "../components/truth-console/types";

interface ChatContextValue {
  /** Live (in-flight) events for the currently-streaming response. Reset on each send. */
  liveEvents: AgentEvent[];
  consoleOpen: boolean;
  sending: boolean;
  /** Which segment the console is viewing. null = "none selected / follow live". */
  activeSegmentId: string | null;
  /** Count of live events that arrived while the active segment wasn't the live one. */
  unreadCount: number;
  setLiveEvents: React.Dispatch<React.SetStateAction<AgentEvent[]>>;
  setConsoleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSending: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSegmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const chatId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const [prevChatId, setPrevChatId] = useState<string | null>(null);

  useEffect(() => {
    if (chatId !== prevChatId) {
      // Don't reset if we are transitioning from "new" to a real chat ID during an active stream/send
      const isPromo = prevChatId === "new" && chatId !== "new" && chatId !== null;
      if (!isPromo) {
        setLiveEvents([]);
        setConsoleOpen(false);
        setSending(false);
        setActiveSegmentId(null);
        setUnreadCount(0);
      }
      setPrevChatId(chatId);
    }
  }, [chatId, prevChatId]);

  return (
    <ChatContext.Provider
      value={{
        liveEvents,
        consoleOpen,
        sending,
        activeSegmentId,
        unreadCount,
        setLiveEvents,
        setConsoleOpen,
        setSending,
        setActiveSegmentId,
        setUnreadCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

export { LIVE_SEGMENT_ID };
