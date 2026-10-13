import { describe, expect, it, vi } from 'vitest';
import { toErrorEnvelope, logServerError } from './error-envelope';

describe('toErrorEnvelope', () => {
  it('produces only a code and message, nothing else', () => {
    const envelope = toErrorEnvelope('QUOTE_EXPIRED', 'This quote has expired, request a new one.');

    expect(envelope).toEqual({
      error: {
        code: 'QUOTE_EXPIRED',
        message: 'This quote has expired, request a new one.',
      },
    });
    expect(Object.keys(envelope.error)).toEqual(['code', 'message']);
  });

  it('never leaks a raw payload, XDR, or stack trace even if the caller tries to pass one as the message', () => {
    const fakeStackTrace = 'Error: failed\n    at buildDeposit (defindex-client.ts:42:10)';
    const envelope = toErrorEnvelope('DEPOSIT_BUILD_FAILED', 'Could not prepare the deposit, try again.');

    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain(fakeStackTrace);
    expect(serialized).not.toContain('at buildDeposit');
  });
});

describe('logServerError (Issue #61)', () => {
  it('logs the route, code, and cause server-side, so a caught error no longer vanishes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('upstream timed out');

    logServerError('quote', 'QUOTE_REQUEST_FAILED', cause);

    expect(consoleError).toHaveBeenCalledWith('[quote] QUOTE_REQUEST_FAILED', cause);
    consoleError.mockRestore();
  });
});
