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

// Invalidate all cache entries matching a pattern (prefix-based)
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    // Use scan to find all keys matching the pattern
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 }) as [string, string[]];
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");

    // Delete all matching keys
    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map(key => redis.del(key)));
    }
  } catch (error) {
    console.error("Failed to invalidate cache pattern:", error);
  }
}

// Rate limiting for AI generation endpoints
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;

  try {
    // Get current count
    const current = await redis.get<number>(key);
    const count = current || 0;

    if (count >= limit) {
      // Get TTL to know when the window resets
      const ttl = await redis.ttl(key);
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000),
        limit,
      };
    }

    // Increment counter
    const pipeline = redis.pipeline();
    pipeline.incr(key);

    // Set expiry only if this is the first request in the window
    if (count === 0) {
      pipeline.expire(key, windowSeconds);
    }

    await pipeline.exec();

    return {
      success: true,
      remaining: limit - count - 1,
      reset: Date.now() + windowSeconds * 1000,
      limit,
    };
  } catch (error) {
    // If Redis fails, allow the request (fail open)
    console.error("Rate limit check failed:", error);
    return {
      success: true,
      remaining: limit,
      reset: Date.now() + windowSeconds * 1000,
      limit,
    };
  }
}
