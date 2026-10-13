import { describe, expect, it, vi, beforeEach } from 'vitest';

const limit = vi.fn();

class RatelimitMock {
  static slidingWindow = vi.fn().mockReturnValue('sliding-window-config');
  limit = limit;
}

const getRedisClient = vi.fn();

vi.mock('@upstash/ratelimit', () => ({ Ratelimit: RatelimitMock }));
vi.mock('@/lib/redis', () => ({ getRedisClient }));

describe('checkRateLimit (Issue #54)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getRedisClient.mockReturnValue({ fakeRedisClient: true });
  });

  it('allows a request within the limit', async () => {
    limit.mockResolvedValue({ success: true });
    const { checkRateLimit } = await import('./rate-limit');

    expect(await checkRateLimit('GCALLER')).toBe(true);
    expect(limit).toHaveBeenCalledWith('GCALLER');
  });

  it('rejects a request over the limit', async () => {
    limit.mockResolvedValue({ success: false });
    const { checkRateLimit } = await import('./rate-limit');

    expect(await checkRateLimit('GCALLER')).toBe(false);
  });

  it('fails open (allows the request) when Redis is unavailable, the already-accepted Threat Model DoS.1/Mon.2 tradeoff', async () => {
    getRedisClient.mockImplementation(() => {
      throw new Error('Upstash Redis is not configured');
    });
    const { checkRateLimit } = await import('./rate-limit');

    expect(await checkRateLimit('GCALLER')).toBe(true);
  });
});

describe('getClientIp (Issue #54)', () => {
  it('reads the first address from x-forwarded-for', async () => {
    const { getClientIp } = await import('./rate-limit');
    const request = new Request('https://zephyroute.app/api/quote', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip, then to a shared "unknown" bucket', async () => {
    const { getClientIp } = await import('./rate-limit');

    expect(getClientIp(new Request('https://zephyroute.app/api/quote'))).toBe('unknown');
  });
});
