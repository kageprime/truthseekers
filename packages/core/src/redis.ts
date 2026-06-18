import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

const options = process.env.NODE_ENV === "test" ? {
  maxRetriesPerRequest: 0,
  enableOfflineQueue: false,
  lazyConnect: true,
} : {};

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, options);
    if (process.env.NODE_ENV === "test") {
      redisClient.on("error", () => {});
    }
  }
  return redisClient;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    redisSubscriber = new Redis(REDIS_URL, options);
    if (process.env.NODE_ENV === "test") {
      redisSubscriber.on("error", () => {});
    }
  }
  return redisSubscriber;
}
