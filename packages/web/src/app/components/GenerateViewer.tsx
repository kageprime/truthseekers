"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { generateArticle, progressUrl } from "@/lib/api";
import PhaseTimeline from "./PhaseTimeline";
import type { AgentEvent } from "./ProcessViewer";

interface GenerateViewerProps {
  slug: string;
  persona?: string;
}

interface Activity {
  id: number;
  timestamp: number;
  type: string;
  content: string;
  icon: string;
  metadata?: string;
}

function eventToActivity(event: AgentEvent, id: number): Activity {
  const base = { id, timestamp: event.timestamp };

  switch (event.type) {
    case "status":
      return { ...base, type: "status", content: String(event.data), icon: "⚡", metadata: undefined };
    case "tool_use": {
      const d = event.data as Record<string, unknown> | undefined;
      const name = (d?.name as string) ?? "unknown";
      const args = d?.args as Record<string, unknown> | undefined;
      return {
        ...base, type: "tool_use", content: labelForTool(name), icon: iconForTool(name),
        metadata: args ? JSON.stringify(args).slice(0, 120) : undefined,
      };
    }
    case "tool_result": {
      const d = event.data as Record<string, unknown> | undefined;
      const result = (d?.result ?? d?.content ?? "") as string;
      const snippet = typeof result === "string" ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200);
      return { ...base, type: "tool_result", content: snippet || "Done", icon: "📋", metadata: undefined };
    }
    case "text": {
      const d = event.data as Record<string, unknown> | undefined;
      const text = (d?.text ?? d?.delta ?? "") as string;
      return { ...base, type: "text", content: text.slice(0, 300), icon: "💬", metadata: undefined };
    }
    case "error":
      return { ...base, type: "error", content: String(event.data), icon: "❌", metadata: undefined };
    default:
      return { ...base, type: event.type, content: String(event.data), icon: "•", metadata: undefined };
  }
}

function labelForTool(name: string): string {
  const labels: Record<string, string> = {
    firecrawl_search: "Searching the web",
    websearch: "Searching the web",
    webfetch: "Fetching a page",
    read: "Reading a file",
    write: "Writing content",
    edit: "Editing content",
    glob: "Searching files",
    grep: "Searching code",
    bash: "Running a command",
    task: "Spawning sub-agent",
    think: "Thinking",
  };
  return labels[name] ?? `Using ${name}`;
}

function iconForTool(name: string): string {
  const icons: Record<string, string> = {
    firecrawl_search: "🔍",
    websearch: "🔍",
    webfetch: "🌐",
    read: "📖",
    write: "✍️",
    edit: "📝",
    glob: "📁",
    grep: "🔎",
    bash: "💻",
    task: "🤖",
    think: "🧠",
  };
  return icons[name] ?? "🔧";
}

export default function GenerateViewer({ slug, persona }: GenerateViewerProps) {
  const [phase, setPhase] = useState("starting");
  const [title, setTitle] = useState(slug.replace(/-/g, " "));
  const [activities, setActivities] = useState<Activity[]>([]);
  const [done, setDone] = useState(false);
  const [errored, setErrored] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [queuing, setQueuing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const idRef = useRef(0);

  const slugRef = useRef(slug);
  slugRef.current = slug;

  useEffect(() => {
    let es: EventSource | null = null;

    async function start() {
      try {
        await generateArticle(slugRef.current, persona || "veritas");
      } catch { /* already queued */ }

      setQueuing(false);
      setReady(true);

      es = new EventSource(progressUrl(slugRef.current));

      es.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        if (data.status === "done" || data.status === "complete") {
          setPhase("done");
          setDone(true);
          es?.close();
        } else if (data.status === "error") {
          setPhase("error");
          setErrored(true);
          setErrorMsg(data.error || "Unknown error");
          es?.close();
        } else {
          setPhase(data.phase || data.status);
        }
      });

      es.addEventListener("agent_event", (e) => {
        const eventData: AgentEvent = JSON.parse(e.data);
        idRef.current += 1;
        const activity = eventToActivity(eventData, idRef.current);
        setActivities((prev) => [...prev, activity]);
      });

      es.onerror = () => {
        // SSE connection will retry automatically
      };
    }

    start();

    return () => {
      if (es) es.close();
    };
  }, [slug, persona]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities.length, autoScroll]);

  const handleRetry = useCallback(() => {
    setPhase("starting");
    setActivities([]);
    setDone(false);
    setErrored(false);
    setErrorMsg("");
    setReady(false);
    setQueuing(true);
    idRef.current = 0;

    let es: EventSource | null = null;

    (async () => {
      try {
        await generateArticle(slugRef.current, persona || "veritas");
      } catch { /* ok */ }

      setQueuing(false);
      setReady(true);

      es = new EventSource(progressUrl(slugRef.current));

      es.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        if (data.status === "done" || data.status === "complete") {
          setPhase("done");
          setDone(true);
          es?.close();
        } else if (data.status === "error") {
          setPhase("error");
          setErrored(true);
          setErrorMsg(data.error || "Unknown error");
          es?.close();
        } else {
          setPhase(data.phase || data.status);
        }
      });

      es.addEventListener("agent_event", (e) => {
        const eventData: AgentEvent = JSON.parse(e.data);
        idRef.current += 1;
        setActivities((prev) => [...prev, eventToActivity(eventData, idRef.current)]);
      });
    })();

    return () => {
      if (es) es.close();
    };
  }, [slug, persona]);

  return (
    <div className="generate-viewer">
      {/* Header */}
      <div className="generate-header">
        <h1 className="generate-title">{title}</h1>
        <PhaseTimeline currentPhase={phase} onError={handleRetry} />
        {queuing && (
          <div className="queuing-banner">
            <span className="queuing-spinner" />
            Adding to queue...
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="activity-feed" ref={scrollRef}>
        {!ready && !queuing && (
          <div className="activity-empty">
            <div className="empty-pulse" />
            <p>Waiting for agent to start...</p>
          </div>
        )}

        {activities.map((a) => (
          <div key={a.id} className={`activity-card ${a.type}`}>
            <div className="activity-icon">{a.icon}</div>
            <div className="activity-body">
              <div className="activity-content">{a.content}</div>
              {a.metadata && <div className="activity-meta"><code>{a.metadata}</code></div>}
            </div>
            <div className="activity-time">
              {new Date(a.timestamp).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
        ))}

        {ready && activities.length === 0 && (
          <div className="activity-empty">
            <div className="empty-pulse" />
            <p>Waiting for agent activity...</p>
          </div>
        )}

        {errored && (
          <div className="activity-card error">
            <div className="activity-icon">❌</div>
            <div className="activity-body">
              <div className="activity-content">Error: {errorMsg}</div>
            </div>
          </div>
        )}

        {done && (
          <div className="done-banner">
            <div className="done-icon">🎉</div>
            <h2>Article Complete</h2>
            <p>The encyclopedia has a new entry on <strong>{title}</strong>.</p>
            <div className="done-actions">
              <a href={`/article/${slug}`} className="btn-primary">Read Article</a>
              <button onClick={handleRetry} className="btn-secondary">Regenerate</button>
            </div>
          </div>
        )}
      </div>

      {/* Auto-scroll toggle */}
      {activities.length > 5 && !done && (
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="scroll-toggle"
        >
          {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        </button>
      )}
    </div>
  );
}
