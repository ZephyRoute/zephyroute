import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('getOrCreateCorrelationWriteProof', () => {
  beforeEach(() => {
    // The module caches the signed proof in a module-level variable; a
    // fresh module registry per test keeps that cache from leaking
    // between tests that assert on whether/how many times a fresh
    // signature was requested.
    vi.resetModules();
    vi.setSystemTime(Date.parse('2026-09-23T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses one signed proof across two calls for the same address within its validity window', async () => {
    const { getOrCreateCorrelationWriteProof } = await import('./correlation-write-proof');
    const signMessage = vi.fn().mockResolvedValue('c2ln');

    const first = await getOrCreateCorrelationWriteProof('GDEPOSITOR', signMessage);
    const second = await getOrCreateCorrelationWriteProof('GDEPOSITOR', signMessage);

    expect(signMessage).toHaveBeenCalledOnce();
    expect(second).toEqual(first);
  });

  it('signs a fresh challenge for a different address, never reusing another address\'s proof', async () => {
    const { getOrCreateCorrelationWriteProof } = await import('./correlation-write-proof');
    const signMessage = vi.fn().mockResolvedValueOnce('sig-a').mockResolvedValueOnce('sig-b');

    const first = await getOrCreateCorrelationWriteProof('GADDRESSA', signMessage);
    const second = await getOrCreateCorrelationWriteProof('GADDRESSB', signMessage);

    expect(signMessage).toHaveBeenCalledTimes(2);
    expect(first.signature).toBe('sig-a');
    expect(second.signature).toBe('sig-b');
  });

  it('signs a fresh challenge once the cached proof falls within the server-side expiry margin', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { getOrCreateCorrelationWriteProof } = await import('./correlation-write-proof');
    const signMessage = vi.fn().mockResolvedValueOnce('sig-1').mockResolvedValueOnce('sig-2');

    await getOrCreateCorrelationWriteProof('GDEPOSITOR', signMessage);
    // auth-nonce.ts's own validity window is 300s; past the 30s reuse
    // margin kept before that boundary, a cached proof must not be
    // handed out, close enough to real expiry that request latency
    // could push it past the server's own check.
    vi.advanceTimersByTime(271 * 1000);
    const second = await getOrCreateCorrelationWriteProof('GDEPOSITOR', signMessage);

    expect(signMessage).toHaveBeenCalledTimes(2);
    expect(second.signature).toBe('sig-2');
  });
});
