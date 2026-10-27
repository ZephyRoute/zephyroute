import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RedisMock = vi.fn();

vi.mock('@upstash/redis', () => ({ Redis: RedisMock }));

const ENV_KEYS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;

describe('getRedisClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    for (const key of ENV_KEYS) vi.stubEnv(key, '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the UPSTASH_REDIS_REST_* names from a manual setup', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://manual.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'manual-token');
    const { getRedisClient } = await import('./redis');
    getRedisClient();
    expect(RedisMock).toHaveBeenCalledWith({ url: 'https://manual.upstash.io', token: 'manual-token' });
  });

  it('falls back to the KV_REST_API_* names the Vercel integration injects', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://vercel.upstash.io');
    vi.stubEnv('KV_REST_API_TOKEN', 'vercel-token');
    const { getRedisClient } = await import('./redis');
    getRedisClient();
    expect(RedisMock).toHaveBeenCalledWith({ url: 'https://vercel.upstash.io', token: 'vercel-token' });
  });

  it('throws visibly when neither pair is configured', async () => {
    const { getRedisClient } = await import('./redis');
    expect(() => getRedisClient()).toThrow(/not configured/);
  });
});
