import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSignature = vi.fn();

vi.mock('@dfns/sdk', async () => {
  const actual = await vi.importActual<typeof import('@dfns/sdk')>('@dfns/sdk');
  return {
    ...actual,
    DfnsApiClient: vi.fn(),
    // A plain function, not an arrow function, `new`-ed by
    // `getDelegatedClient()`; explicitly returning an object from a
    // constructor call makes `new` return that object instead of
    // `this`, the standard way to mock a constructed class instance.
    DfnsDelegatedApiClient: vi.fn(function DfnsDelegatedApiClient() {
      return { wallets: { getSignature } };
    }),
  };
});
vi.mock('@dfns/sdk-keysigner', () => ({ AsymmetricKeySigner: vi.fn() }));

const REQUIRED_ENV = {
  DFNS_ORG_ID: 'org1',
  DFNS_SERVICE_ACCOUNT_AUTH_TOKEN: 'token',
  DFNS_SERVICE_ACCOUNT_CRED_ID: 'cred1',
  DFNS_SERVICE_ACCOUNT_PRIVATE_KEY: 'key',
};

describe('dfns-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.assign(process.env, REQUIRED_ENV);
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const key of Object.keys(REQUIRED_ENV)) delete process.env[key];
  });

  describe('waitForWalletSignature', () => {
    it('polls until the signature reaches Signed, not resolving on an intermediate status', async () => {
      const { waitForWalletSignature } = await import('./dfns-client');
      getSignature
        .mockResolvedValueOnce({ status: 'Executing' })
        .mockResolvedValueOnce({ status: 'Signed', signature: { encoded: 'ab' } });

      const promise = waitForWalletSignature('w1', 'sig1');
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result.status).toBe('Signed');
      expect(getSignature).toHaveBeenCalledTimes(2);
    });

    it('resolves immediately on Confirmed, never treating it as still-pending', async () => {
      const { waitForWalletSignature } = await import('./dfns-client');
      getSignature.mockResolvedValue({ status: 'Confirmed', signature: { encoded: 'ab' } });

      const result = await waitForWalletSignature('w1', 'sig1');
      expect(result.status).toBe('Confirmed');
      expect(getSignature).toHaveBeenCalledTimes(1);
    });

    it('throws on a DFNS-reported Failed status, never resolving as if signed', async () => {
      const { waitForWalletSignature, DfnsRequestError } = await import('./dfns-client');
      getSignature.mockResolvedValue({ status: 'Failed', reason: 'policy denied' });

      await expect(waitForWalletSignature('w1', 'sig1')).rejects.toBeInstanceOf(DfnsRequestError);
    });

    it('throws on a DFNS-reported Rejected status', async () => {
      const { waitForWalletSignature, DfnsRequestError } = await import('./dfns-client');
      getSignature.mockResolvedValue({ status: 'Rejected' });

      await expect(waitForWalletSignature('w1', 'sig1')).rejects.toBeInstanceOf(DfnsRequestError);
    });

    it('times out rather than polling forever if the signature never resolves', async () => {
      const { waitForWalletSignature, DfnsSigningTimeoutError } = await import('./dfns-client');
      getSignature.mockResolvedValue({ status: 'Pending' });

      const promise = waitForWalletSignature('w1', 'sig1');
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(30000);

      await expect(promise).rejects.toBeInstanceOf(DfnsSigningTimeoutError);
    });
  });

  describe('extractSignatureBytes', () => {
    it('prefers the encoded signature when present', async () => {
      const { extractSignatureBytes } = await import('./dfns-client');
      const bytes = extractSignatureBytes({
        status: 'Signed',
        signature: { encoded: 'ab'.repeat(4) },
      } as never);
      expect(bytes).toEqual(new Uint8Array(Buffer.from('ab'.repeat(4), 'hex')));
    });

    it('falls back to concatenated r+s when no encoded signature is present', async () => {
      const { extractSignatureBytes } = await import('./dfns-client');
      const bytes = extractSignatureBytes({
        status: 'Signed',
        signature: { r: 'ab'.repeat(2), s: 'cd'.repeat(2) },
      } as never);
      expect(bytes).toEqual(new Uint8Array(Buffer.from('ab'.repeat(2) + 'cd'.repeat(2), 'hex')));
    });

    it('throws when neither an encoded nor an r/s signature is present', async () => {
      const { extractSignatureBytes, DfnsRequestError } = await import('./dfns-client');
      expect(() => extractSignatureBytes({ status: 'Signed' } as never)).toThrow(
        DfnsRequestError
      );
    });
  });
});
