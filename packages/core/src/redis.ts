import { Redis } from "@upstash/redis";

const REDIS_URL = process.env.REDIS_URL || "";
const REDIS_TOKEN = process.env.REDIS_TOKEN || "";

let client: Redis | null = null;

function getUpstashClient(): Redis | null {
  if (typeof window !== "undefined") return null;
  if (!REDIS_URL) return null;
  if (!client) {
    try {
      client = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
    } catch {
      return null;
    }
  }
  return client;
}

export function getRedisClient() {
  const c = getUpstashClient();
  if (c) {
    return {
      on: (..._args: any[]) => {},
      publish: (channel: string, msg: string) => c.publish(channel, msg),
      subscribe: (..._args: any[]) => Promise.resolve(),
      off: (..._args: any[]) => {},
      get: (key: string) => c.get<string>(key),
      set: (...args: any[]) => c.set(args[0], args[1]),
    };
  }
  return {
    on: (..._args: any[]) => {},
    publish: (_channel: string, _msg: string) => Promise.resolve(0),
    subscribe: (..._args: any[]) => Promise.resolve(),
    off: (..._args: any[]) => {},
    get: (_key: string) => Promise.resolve(null),
    set: (..._args: any[]) => Promise.resolve("OK"),
  };
}

export function getRedisSubscriber() {
  // ponytail: Upstash Redis HTTP client doesn't support subscribe.
  // In-memory pub/sub in queue.ts handles single-instance.
  // Switch to QStash or Redis Streams for multi-instance sync.
  return {
    on: (..._args: any[]) => {},
    subscribe: (..._args: any[]) => Promise.resolve(),
    off: (..._args: any[]) => {},
  };
}
