"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AgentEvent } from "../components/ProcessViewer";

interface ChatContextValue {
  agentEvents: AgentEvent[];
  consoleOpen: boolean;
  sending: boolean;
  setAgentEvents: React.Dispatch<React.SetStateAction<AgentEvent[]>>;
  setConsoleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSending: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const pathname = usePathname();

  // Reset on navigation to a different chat
  const chatId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : null;
  useEffect(() => {
    setAgentEvents([]);
    setConsoleOpen(false);
    setSending(false);
  }, [chatId]);

  return (
    <ChatContext.Provider value={{ agentEvents, consoleOpen, sending, setAgentEvents, setConsoleOpen, setSending }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
