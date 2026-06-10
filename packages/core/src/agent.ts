import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";

const OPENCODE_URL = process.env.OPENCODE_SERVER_URL || "http://localhost:4096";

let client: OpencodeClient | null = null;

export function getClient(): OpencodeClient {
  if (!client) {
    client = createOpencodeClient({ baseUrl: OPENCODE_URL });
    console.log(`OpenCode client connected to ${OPENCODE_URL}`);
  }
  return client;
}

export async function createSession(title: string): Promise<string> {
  const c = getClient();
  const result = await c.session.create({ body: { title } });
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Failed to create session: ${JSON.stringify(err)}`);
  }
  return result.data!.id;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const c = getClient();
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
  const c = getClient();
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
  const c = getClient();
  const result = await c.session.messages({ path: { id: sessionId } });
  if (result.error) {
    const err = result.error as Record<string, unknown>;
    throw new Error(`Failed to get messages: ${JSON.stringify(err)}`);
  }
  return result.data ?? [];
}
