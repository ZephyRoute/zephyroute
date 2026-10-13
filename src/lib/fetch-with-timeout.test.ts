import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, withTimeout, FetchTimeoutError } from './fetch-with-timeout';

describe('fetchWithTimeout (Issue #56)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves normally when the request completes before the timeout', async () => {
    const response = new Response('ok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const result = await fetchWithTimeout('https://example.com', {}, 5000);

    expect(result).toBe(response);
  });

  it('passes the given init options through alongside the abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithTimeout('https://example.com', { method: 'POST' }, 5000);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
    );
  });

  it('throws FetchTimeoutError instead of hanging forever when the request never resolves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          })
      )
    );

    const promise = fetchWithTimeout('https://example.com', {}, 5000);
    const assertion = expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);

    await assertion;
  });
});

describe('withTimeout (Issue #56, for SDKs with no timeout option of their own)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 5000);

    expect(result).toBe('ok');
  });

  it('rejects with the original error when the promise rejects before the timeout', async () => {
    const cause = new Error('upstream failed');

    await expect(withTimeout(Promise.reject(cause), 5000)).rejects.toBe(cause);
  });

  it('throws FetchTimeoutError instead of hanging forever when the promise never settles', async () => {
    const neverSettles = new Promise(() => {});

    const promise = withTimeout(neverSettles, 5000);
    const assertion = expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);

    await assertion;
  });
});
