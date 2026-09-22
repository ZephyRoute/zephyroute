import { describe, expect, it, vi, beforeEach } from 'vitest';

const { initWalletSignature } = vi.hoisted(() => ({ initWalletSignature: vi.fn() }));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, initWalletSignature };
});

const { POST } = await import('./route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/fund/sign-init', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/fund/sign-init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a body missing walletId or hashHex with a 400', async () => {
    const response = await POST(postRequest({ walletId: 'w1' }));

    expect(response.status).toBe(400);
    expect(initWalletSignature).not.toHaveBeenCalled();
  });

  it('returns the signing challenge on success', async () => {
    initWalletSignature.mockResolvedValue({ challengeIdentifier: 'ci' });

    const response = await POST(postRequest({ walletId: 'w1', hashHex: 'ab'.repeat(32) }));

    expect(response.status).toBe(200);
    expect(initWalletSignature).toHaveBeenCalledWith('w1', 'ab'.repeat(32));
  });
});
