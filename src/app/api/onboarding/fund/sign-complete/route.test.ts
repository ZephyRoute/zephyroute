import { describe, expect, it, vi, beforeEach } from 'vitest';

const { completeWalletSignature, getWalletSignature, attachSignatureAndSubmit } = vi.hoisted(() => ({
  completeWalletSignature: vi.fn(),
  getWalletSignature: vi.fn(),
  attachSignatureAndSubmit: vi.fn(),
}));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, completeWalletSignature, getWalletSignature };
});
vi.mock('@/lib/onboarding-transaction', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding-transaction')>(
    '@/lib/onboarding-transaction'
  );
  return { ...actual, attachSignatureAndSubmit };
});

const { POST } = await import('./route');

const VALID_BODY = {
  walletId: 'w1',
  hashHex: 'ab'.repeat(32),
  signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
  partiallySignedXdr: 'AAAAAgAAAAB',
  stellarAddress: 'GNEW',
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/fund/sign-complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/fund/sign-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeWalletSignature.mockResolvedValue({ id: 'sig1', status: 'Pending' });
  });

  it('rejects a body missing required fields with a 400, never reaching DFNS', async () => {
    const response = await POST(postRequest({ walletId: 'w1' }));

    expect(response.status).toBe(400);
    expect(completeWalletSignature).not.toHaveBeenCalled();
  });

  it('polls until Signed, extracts the encoded signature, attaches, and submits (happy path)', async () => {
    getWalletSignature
      .mockResolvedValueOnce({ status: 'Executing' })
      .mockResolvedValueOnce({ status: 'Signed', signature: { encoded: 'ab'.repeat(64) } });
    attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ hash: 'DEADBEEF', successful: true });
    expect(attachSignatureAndSubmit).toHaveBeenCalledWith(
      'AAAAAgAAAAB',
      'GNEW',
      new Uint8Array(Buffer.from('ab'.repeat(64), 'hex'))
    );
  });

  it('falls back to concatenated r+s when no encoded signature is present', async () => {
    getWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { r: 'ab'.repeat(32), s: 'cd'.repeat(32) },
    });
    attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    await POST(postRequest(VALID_BODY));

    expect(attachSignatureAndSubmit).toHaveBeenCalledWith(
      'AAAAAgAAAAB',
      'GNEW',
      new Uint8Array(Buffer.from('ab'.repeat(32) + 'cd'.repeat(32), 'hex'))
    );
  });

  it('surfaces a rejected on-chain submission as a 502, never a false success', async () => {
    getWalletSignature.mockResolvedValue({ status: 'Signed', signature: { encoded: 'ab'.repeat(64) } });
    attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: false });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('ONBOARDING_SUBMISSION_REJECTED');
  });

  it('surfaces a DFNS-reported Failed/Rejected signing as a 502, never a silent hang', async () => {
    getWalletSignature.mockResolvedValue({ status: 'Failed', reason: 'policy denied' });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(502);
    expect(attachSignatureAndSubmit).not.toHaveBeenCalled();
  });
});
