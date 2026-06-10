declare module "@opencode-ai/sdk" {
  interface OpencodeClient {
    session: {
      create(args: { body?: { title?: string; parentID?: string } }): Promise<{ data?: { id: string }; error?: { message: string; name?: string } }>;
      delete(args: { path: { id: string } }): Promise<{ error?: { message: string; name?: string } }>;
      prompt(args: {
        path: { id: string };
        body: {
          agent?: string;
          parts: Array<{ type: "text"; text: string }>;
          format?: { type: "json_schema"; schema: Record<string, unknown> };
          noReply?: boolean;
          model?: { providerID: string; modelID: string };
        };
      }): Promise<{
        data?: {
          parts?: Array<{ type: "text"; text: string; [key: string]: unknown }>;
          info?: { id: string; structured_output?: unknown; error?: { name: string; message: string; retries?: number } };
        };
        error?: { message: string; name?: string };
      }>;
      messages(args: { path: { id: string } }): Promise<{ data?: unknown[]; error?: { message: string; name?: string } }>;
      command(args: {
        path: { id: string };
        body: { command: string; arguments?: string };
      }): Promise<{ data?: unknown; error?: { message: string; name?: string } }>;
    };
    event: {
      subscribe(): Promise<{ stream: AsyncIterable<{ type: string; properties: Record<string, unknown> }> }>;
    };
  }

  function createOpencodeClient(args: { baseUrl: string }): OpencodeClient;
  function createOpencode(args?: {
    hostname?: string;
    port?: number;
    signal?: AbortSignal;
    timeout?: number;
    config?: Record<string, unknown>;
  }): Promise<{ client: OpencodeClient; server: { url: string; close: () => void } }>;

  export { createOpencodeClient, createOpencode };
  export type { OpencodeClient };
}
