export class FetchTimeoutError extends Error {}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Issue #56: no `fetch()` call anywhere in this codebase set a timeout
 * before this, so a hung upstream (1Click, DeFindex, DFNS, Horizon, or
 * this app's own API routes relaying them) left the caller's UI stuck
 * on its loading state indefinitely, no escape, no error message. A
 * drop-in replacement for `fetch`: same signature plus an optional
 * timeout, aborts and throws `FetchTimeoutError` rather than hanging,
 * which callers can handle the same way they already handle any other
 * network failure, or inspect specifically if they want a distinct
 * "timed out" message.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new FetchTimeoutError('The request timed out. Try again.', { cause });
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * For third-party SDK calls (the 1Click SDK here) that don't expose
 * their own timeout option and aren't a plain `fetch()` call this file
 * can otherwise wrap directly. Races the given promise against a
 * timer; the underlying request itself is not aborted (the SDK gives
 * no handle for that), only the wait for it is bounded, so the caller
 * stops hanging even though the real network request may still
 * complete in the background.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new FetchTimeoutError('The request timed out. Try again.'));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timeout);
        reject(cause);
      }
    );
  });
}
