import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const ONE_HOUR_IN_SECONDS = 60 * 60;

export async function getCached<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = ONE_HOUR_IN_SECONDS
): Promise<void> {
  await redis.set(key, value, { ex: ttlSeconds });
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}
