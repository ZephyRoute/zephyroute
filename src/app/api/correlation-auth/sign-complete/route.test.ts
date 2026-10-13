import { describe, expect, it, vi, beforeEach } from 'vitest';

const { completeWalletSignature, waitForWalletSignature } = vi.hoisted(() => ({
  completeWalletSignature: vi.fn(),
  waitForWalletSignature: vi.fn(),
}));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, completeWalletSignature, waitForWalletSignature };
});

const { POST } = await import('./route');

const VALID_BODY = {
  walletId: 'w1',
  hashHex: 'ab'.repeat(32),
  signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/correlation-auth/sign-complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/correlation-auth/sign-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeWalletSignature.mockResolvedValue({ id: 'sig1', status: 'Pending' });
  });

  it('rejects a body missing required fields with a 400, never reaching DFNS', async () => {
    const response = await POST(postRequest({ walletId: 'w1' }));

    expect(response.status).toBe(400);
    expect(completeWalletSignature).not.toHaveBeenCalled();
  });

  it('waits for the signature and returns it base64-encoded, never attaching to or submitting a transaction', async () => {
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ signature: Buffer.from('ab'.repeat(64), 'hex').toString('base64') });
  });

  it('reports a 503 with a message-signing-specific code when DFNS is not configured', async () => {
    const { DfnsConfigError } = await import('@/lib/dfns-client');
    completeWalletSignature.mockRejectedValue(new DfnsConfigError('not configured'));

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error.code).toBe('DFNS_NOT_CONFIGURED');
  });
});
