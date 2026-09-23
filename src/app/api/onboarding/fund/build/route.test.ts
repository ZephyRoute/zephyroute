import { describe, expect, it, vi, beforeEach } from 'vitest';

const { buildOnboardingTransaction, consumeRegistrationToken } = vi.hoisted(() => ({
  buildOnboardingTransaction: vi.fn(),
  consumeRegistrationToken: vi.fn(),
}));

vi.mock('@/lib/onboarding-transaction', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding-transaction')>(
    '@/lib/onboarding-transaction'
  );
  return { ...actual, buildOnboardingTransaction };
});
vi.mock('@/lib/onboarding-registration-token', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding-registration-token')>(
    '@/lib/onboarding-registration-token'
  );
  return { ...actual, consumeRegistrationToken };
});

const { POST } = await import('./route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/fund/build', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  stellarAddress: 'GNEW',
  assetCode: 'USDC',
  assetIssuer: 'GISSUER',
  registrationToken: 'reg-token-1',
};

describe('POST /api/onboarding/fund/build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeRegistrationToken.mockResolvedValue(undefined);
  });

  it('rejects a body missing stellarAddress, assetCode, or registrationToken with a 400', async () => {
    const response = await POST(postRequest({ stellarAddress: 'GNEW' }));

    expect(response.status).toBe(400);
    expect(consumeRegistrationToken).not.toHaveBeenCalled();
    expect(buildOnboardingTransaction).not.toHaveBeenCalled();
  });

  it('builds with the given asset and returns the unsigned transaction, only after the registration token verifies', async () => {
    buildOnboardingTransaction.mockResolvedValue({
      partiallySignedXdr: 'AAAAAgAAAAB',
      hashHex: 'ab'.repeat(32),
    });

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    expect(consumeRegistrationToken).toHaveBeenCalledWith('reg-token-1', 'GNEW');
    expect(buildOnboardingTransaction).toHaveBeenCalledWith('GNEW', {
      code: 'USDC',
      issuer: 'GISSUER',
    });
  });

  it(
    'rejects with a 403, never building a sponsor-signed transaction, when the registration token is ' +
      'missing, expired, or for a different address (the sponsor-treasury-drain finding)',
    async () => {
      const { RegistrationTokenError } = await import('@/lib/onboarding-registration-token');
      consumeRegistrationToken.mockRejectedValue(
        new RegistrationTokenError('This account was not just registered through onboarding.')
      );

      const response = await POST(postRequest(VALID_BODY));

      expect(response.status).toBe(403);
      expect(buildOnboardingTransaction).not.toHaveBeenCalled();
    }
  );

  it('surfaces an unconfigured sponsor as a 503', async () => {
    const { SponsorConfigError } = await import('@/lib/onboarding-transaction');
    buildOnboardingTransaction.mockRejectedValue(
      new SponsorConfigError('ZEPHYROUTE_SPONSOR_SECRET_KEY is not configured.')
    );

    const response = await POST(
      postRequest({ ...VALID_BODY, assetCode: 'XLM', assetIssuer: undefined })
    );

    expect(response.status).toBe(503);
  });
});
