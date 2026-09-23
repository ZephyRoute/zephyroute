import { describe, expect, it, vi, beforeEach } from 'vitest';

const { completeWalletSignature, waitForWalletSignature, attachDepositorSignatureAndSubmit } =
  vi.hoisted(() => ({
    completeWalletSignature: vi.fn(),
    waitForWalletSignature: vi.fn(),
    attachDepositorSignatureAndSubmit: vi.fn(),
  }));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, completeWalletSignature, waitForWalletSignature };
});
vi.mock('@/lib/deposit-dfns-signing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/deposit-dfns-signing')>(
    '@/lib/deposit-dfns-signing'
  );
  return { ...actual, attachDepositorSignatureAndSubmit };
});

const { POST } = await import('./route');

const VALID_BODY = {
  walletId: 'w1',
  hashHex: 'ab'.repeat(32),
  signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
  unsignedXdr: 'AAAAAgAAAAB',
  depositorAddress: 'GDEPOSITOR',
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/deposit/sign-complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/deposit/sign-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeWalletSignature.mockResolvedValue({ id: 'sig1', status: 'Pending' });
  });

  it('rejects a body missing required fields with a 400, never reaching DFNS', async () => {
    const response = await POST(postRequest({ walletId: 'w1' }));

    expect(response.status).toBe(400);
    expect(completeWalletSignature).not.toHaveBeenCalled();
  });

  it('waits for the signature, extracts it, attaches to the unsigned deposit XDR, and submits (happy path)', async () => {
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });
    attachDepositorSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ hash: 'DEADBEEF', successful: true });
    expect(attachDepositorSignatureAndSubmit).toHaveBeenCalledWith(
      'AAAAAgAAAAB',
      'GDEPOSITOR',
      new Uint8Array(Buffer.from('ab'.repeat(64), 'hex'))
    );
  });

  it('reports an on-chain revert as a successful HTTP response with successful: false, never a false success (Story 1.11 parity)', async () => {
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });
    attachDepositorSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: false });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.successful).toBe(false);
  });

  it('reports a 503 with a deposit-specific code when DFNS is not configured', async () => {
    const { DfnsConfigError } = await import('@/lib/dfns-client');
    completeWalletSignature.mockRejectedValue(new DfnsConfigError('not configured'));

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error.code).toBe('DFNS_NOT_CONFIGURED');
  });
});
