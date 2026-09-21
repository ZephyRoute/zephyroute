import { Redis } from '@upstash/redis';

let client: Redis | null = null;

/**
 * Rule #9: the correlation record is a convenience cache, never the
 * source of truth. Lazily constructed so a missing Upstash config
 * doesn't crash module load, callers decide how to handle an
 * unconfigured cache (fall back to direct Horizon/DeFindex queries,
 * per AC #9), not this module.
 */
export function getRedisClient(): Redis {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Upstash Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN missing).');
  }

  client = new Redis({ url, token });
  return client;
}
