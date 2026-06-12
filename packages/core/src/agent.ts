import { createOpencode, createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import type { AgentEvent } from "./types.js";

let clientPromise: Promise<OpencodeClient> | null = null;
let baseUrlResolve: ((url: string) => void) | null = null;
const baseUrlPromise: Promise<string> = Promise.race([
  new Promise<string>(r => { baseUrlResolve = r; }),
  new Promise<string>(r => setTimeout(() => r("http://127.0.0.1:4098"), 10000)),
]);

function loadConfig(): Record<string, unknown> {
  try {
    const configPath = path.join(process.cwd(), "opencode.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

async function tryConnect(url: string, label: string): Promise<OpencodeClient | null> {
  try {
    const client = createOpencodeClient({ baseUrl: url });
    const sess = await (client.session.create as any)(withSignal({ body: { title: "__probe__" } }, AbortSignal.timeout(3000)));
    if (sess.data?.id) {
      await (client.session.delete as any)(withSignal({ path: { id: sess.data.id } }, AbortSignal.timeout(2000))).catch(() => {});
      console.log(`Connected to OpenCode server: ${label} (${url})`);
      return client;
    }
  } catch { /* no response */ }
  return null;
}

async function initClient(): Promise<OpencodeClient> {
  const config = loadConfig();
  const externalUrl = process.env.OPENCODE_SERVER_URL;

  // 1. If OPENCODE_SERVER_URL is set, connect to that external server (no spawning)
  if (externalUrl) {
    const url = externalUrl.replace(/\/$/, "");
    const client = await tryConnect(url, "external");
    if (client) { baseUrlResolve?.(url); return client; }
    console.warn(`OPENCODE_SERVER_URL=${externalUrl} is not responding, falling back to local discovery`);
  }

  // 2. Try connecting to an existing local server on common ports
  const ports = [4098, 4096, 4097, 4099, 4100];
  for (const p of ports) {
    const url = `http://127.0.0.1:${p}`;
    const client = await tryConnect(url, `port ${p}`);
    if (client) { baseUrlResolve?.(url); return client; }
  }

  // 3. Fall back: spawn our own server on a free port
  const spawnPort = parseInt(process.env.OPENCODE_SERVER_PORT || "4098", 10);
  for (let tryPort = spawnPort; tryPort < spawnPort + 10; tryPort++) {
    try {
      console.log(`Starting OpenCode server on port ${tryPort}...`);
      const result = await createOpencode({ hostname: "127.0.0.1", port: tryPort, config });
      console.log(`OpenCode server ready at ${result.server.url}`);
      baseUrlResolve?.(result.server.url);
      return result.client;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("EADDRINUSE") || msg.includes("ServeError")) continue;
      throw err;
    }
  }

  throw new Error("Could not start OpenCode server on any port (4098–4107)");
}

export async function getClient(): Promise<OpencodeClient> {
  if (!clientPromise) {
    clientPromise = initClient();
  }
  return clientPromise;
}

const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MS || "30000", 10);
const PROMPT_TIMEOUT = parseInt(process.env.PROMPT_TIMEOUT_MS || "600000", 10);

function withSignal<T>(opts: T, signal: AbortSignal): T & { signal: AbortSignal } {
  return Object.assign({}, opts, { signal }) as T & { signal: AbortSignal };
}

export async function createSession(title: string): Promise<string> {
  const c = await getClient();
  const signal = AbortSignal.timeout(SESSION_TIMEOUT);
  const result = await c.session.create(withSignal({ body: { title } }, signal));
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Failed to create session: ${JSON.stringify(err)}`);
  }
  return result.data!.id;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const c = await getClient();
  const signal = AbortSignal.timeout(5000);
  try {
    await c.session.delete(withSignal({ path: { id: sessionId } }, signal));
  } catch (err) {
    console.warn(`Session cleanup failed for ${sessionId}:`, err);
  }
}

export interface PromptResult {
  text: string;
  structuredOutput?: unknown;
}

export async function sendPrompt(
  sessionId: string,
  text: string,
  options?: {
    system?: string;
    noReply?: boolean;
  }
): Promise<PromptResult> {
  const c = await getClient();
  const body: Record<string, unknown> = {
    parts: [{ type: "text", text }],
  };
  if (options?.system) body.system = options.system;
  if (options?.noReply !== undefined) body.noReply = options.noReply;

  const signal = AbortSignal.timeout(PROMPT_TIMEOUT);
  const result = await c.session.prompt(withSignal({
    path: { id: sessionId },
    body: body as Parameters<typeof c.session.prompt>[0]["body"],
  }, signal));
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Prompt failed: ${JSON.stringify(err)}`);
  }

  const parts = result.data?.parts ?? [];
  const textParts = parts.filter((p) => p.type === "text");
  const textContent = textParts.map((p) => p.text).join("\n");

  const info = result.data?.info as Record<string, unknown> | undefined;

  return {
    text: textContent,
    structuredOutput: info?.structured_output,
  };
}

const MAX_SSE_EVENTS = 200;

export interface StreamEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export async function sendPromptStream(
  sessionId: string,
  text: string,
  onEvent?: (event: AgentEvent) => void,
  options?: { system?: string; noReply?: boolean }
): Promise<PromptResult> {
  const c = await getClient();

  // 1. Send prompt async
  const body: Record<string, unknown> = {
    parts: [{ type: "text", text }],
  };
  if (options?.system) body.system = options.system;
  if (options?.noReply !== undefined) body.noReply = options.noReply;

  const signal = AbortSignal.timeout(PROMPT_TIMEOUT);
  const asyncRes = await (c.session as any).promptAsync(withSignal({
    path: { id: sessionId },
    body: body as any,
  }, signal));
  if (asyncRes.error) {
    const err = asyncRes.error as Record<string, unknown>;
    throw new Error(`PromptAsync failed: ${JSON.stringify(err)}`);
  }

  // 2. Try SSE (session-level or fallback to global)
  let completionResolved = false;

  const trySse = async (url: string): Promise<boolean> => {
    try {
      const sseRes = await fetch(url, { signal: AbortSignal.timeout(PROMPT_TIMEOUT) });
      if (!sseRes.ok || !sseRes.body) return false;

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          if (eventCount++ >= MAX_SSE_EVENTS) break;
          const lines = part.split("\n");
          let eventType = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) {
              const d = line.slice(6).trim();
              dataStr = dataStr ? dataStr + "\n" + d : d;
            }
          }

          if (!dataStr) continue;

          let parsedData: unknown = dataStr;
          try { parsedData = JSON.parse(dataStr); } catch { /* keep as string */ }

          onEvent?.({
            type: (eventType || "text") as any,
            data: parsedData,
            timestamp: Date.now(),
          });

          if (eventType === "status" && (dataStr === '"done"' || parsedData === "done")) {
            return true;
          }
        }
      }
    } catch {
      // SSE connection failed
    }
    return false;
  };

  // Try session-level events endpoint
  const baseUrl = await baseUrlPromise;
  const sseUrl = `${baseUrl}/session/${sessionId}/events`;
  completionResolved = await trySse(sseUrl);

  if (!completionResolved) {
    // Fallback: poll for completion
    let attempts = 0;
    while (attempts < 120) {
      await new Promise(r => setTimeout(r, 500));
      attempts++;
      try {
        const msgRes = await c.session.messages(withSignal({
          path: { id: sessionId },
        }, AbortSignal.timeout(5000)));
        const msgs: any[] = (msgRes.data ?? []) as any[];
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            onEvent?.({
              type: "status",
              data: "done",
              timestamp: Date.now(),
            });
            completionResolved = true;
            break;
          }
        }
      } catch { /* retry */ }
    }
  }

  // 3. Extract final result from messages
  const msgRes = await c.session.messages(withSignal({
    path: { id: sessionId },
  }, AbortSignal.timeout(10000)));
  const msgs: any[] = (msgRes.data ?? []) as any[];
  const assistantMsg = [...msgs].reverse().find((m) => m.role === "assistant" && m.parts?.length);

  if (!assistantMsg) {
    // Fall back to re-sending prompt as blocking call
    const result = await c.session.prompt(withSignal({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text }],
      } as any,
    }, AbortSignal.timeout(PROMPT_TIMEOUT)));

    if (result.error) {
      const err = result.error as Record<string, unknown>;
      throw new Error(`Prompt failed: ${JSON.stringify(err)}`);
    }

    const parts = result.data?.parts ?? [];
    const textParts = parts.filter((p: any) => p.type === "text");
    const textContent = textParts.map((p: any) => p.text).join("\n");
    const info = result.data?.info as Record<string, unknown> | undefined;
    return { text: textContent, structuredOutput: info?.structured_output };
  }

  const parts: any[] = (assistantMsg as any).parts ?? [];
  const textParts = parts.filter((p: any) => p.type === "text");
  const textContent = textParts.map((p: any) => p.text).join("\n");
  const info = (assistantMsg as any).info as Record<string, unknown> | undefined;

  return {
    text: textContent,
    structuredOutput: info?.structured_output,
  };
}

export async function getSessionMessages(sessionId: string) {
  const c = await getClient();
  const result = await c.session.messages({ path: { id: sessionId } });
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Failed to get messages: ${JSON.stringify(err)}`);
  }
  return result.data ?? [];
}
