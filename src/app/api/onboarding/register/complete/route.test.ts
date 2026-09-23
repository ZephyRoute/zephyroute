import { describe, expect, it, vi, beforeEach } from 'vitest';

const { completeEndUserRegistration } = vi.hoisted(() => ({
  completeEndUserRegistration: vi.fn(),
}));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, completeEndUserRegistration };
});

const { POST } = await import('./route');

const VALID_CREDENTIAL = {
  credentialKind: 'Fido2' as const,
  credentialInfo: { credId: 'c1', clientData: 'cd', attestationData: 'ad' },
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/register/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/register/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a body missing required fields with a 400', async () => {
    const response = await POST(postRequest({ walletName: 'zephyroute' }));

    expect(response.status).toBe(400);
    expect(completeEndUserRegistration).not.toHaveBeenCalled();
  });

  it('extracts the Stellar wallet address from the response on success', async () => {
    completeEndUserRegistration.mockResolvedValue({
      user: { id: 'u1', username: 'u', orgId: 'o1' },
      authentication: { token: 'end-user-token' },
      wallets: [{ id: 'w1', network: 'Stellar', address: 'GNEWACCOUNT' }],
      credential: { uuid: 'c1', kind: 'Fido2', name: 'passkey' },
    });

    const response = await POST(
      postRequest({ firstFactorCredential: VALID_CREDENTIAL, walletName: 'zephyroute' })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      userId: 'u1',
      authToken: 'end-user-token',
      walletId: 'w1',
      stellarAddress: 'GNEWACCOUNT',
    });
  });

  it('surfaces a missing Stellar wallet in the response as a 502, never crashing', async () => {
    completeEndUserRegistration.mockResolvedValue({
      user: { id: 'u1', username: 'u' },
      authentication: { token: 't' },
      wallets: [],
      credential: { uuid: 'c1', kind: 'Fido2', name: 'passkey' },
    });

    const response = await POST(
      postRequest({ firstFactorCredential: VALID_CREDENTIAL, walletName: 'zephyroute' })
    );

    expect(response.status).toBe(502);
  });
});
