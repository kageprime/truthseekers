import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "";

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (!REDIS_URL) {
      // ponytail: no-op stub, Redis unavailable
      redisClient = { on: () => {}, publish: () => Promise.resolve(0), subscribe: () => Promise.resolve(), off: () => {}, get: () => Promise.resolve(null), set: () => Promise.resolve("OK") } as unknown as Redis;
    } else {
      redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true, retryStrategy: () => null });
      redisClient.on("error", () => {});
    }
  }
  return redisClient;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    if (!REDIS_URL) {
      redisSubscriber = { on: () => {}, subscribe: () => Promise.resolve(), off: () => {} } as unknown as Redis;
    } else {
      redisSubscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true, retryStrategy: () => null });
      redisSubscriber.on("error", () => {});
    }
  }
  return redisSubscriber;
}
