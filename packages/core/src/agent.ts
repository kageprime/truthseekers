import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk";
import fs from "node:fs";
import path from "node:path";

let clientPromise: Promise<OpencodeClient> | null = null;

function loadConfig(): Record<string, unknown> {
  try {
    const configPath = path.join(process.cwd(), "opencode.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

async function initClient(): Promise<OpencodeClient> {
  const config = loadConfig();
  const port = parseInt(process.env.OPENCODE_SERVER_PORT || "4096", 10);
  console.log(`Starting embedded OpenCode server on port ${port}...`);
  const result = await createOpencode({ hostname: "127.0.0.1", port, config });
  console.log(`Embedded OpenCode server ready at ${result.server.url}`);
  return result.client;
}

export async function getClient(): Promise<OpencodeClient> {
  if (!clientPromise) {
    clientPromise = initClient();
  }
  return clientPromise;
}

export async function createSession(title: string): Promise<string> {
  const c = await getClient();
  const result = await c.session.create({ body: { title } });
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Failed to create session: ${JSON.stringify(err)}`);
  }
  return result.data!.id;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const c = await getClient();
  await c.session.delete({ path: { id: sessionId } });
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

  const result = await c.session.prompt({
    path: { id: sessionId },
    body: body as Parameters<typeof c.session.prompt>[0]["body"],
  });
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

export async function getSessionMessages(sessionId: string) {
  const c = await getClient();
  const result = await c.session.messages({ path: { id: sessionId } });
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Failed to get messages: ${JSON.stringify(err)}`);
  }
  return result.data ?? [];
}
