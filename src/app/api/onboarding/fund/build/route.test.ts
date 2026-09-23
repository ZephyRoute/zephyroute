import { describe, expect, it, vi, beforeEach } from 'vitest';

const { buildOnboardingTransaction } = vi.hoisted(() => ({
  buildOnboardingTransaction: vi.fn(),
}));

vi.mock('@/lib/onboarding-transaction', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding-transaction')>(
    '@/lib/onboarding-transaction'
  );
  return { ...actual, buildOnboardingTransaction };
});

const { POST } = await import('./route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/fund/build', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/fund/build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a body missing stellarAddress or assetCode with a 400', async () => {
    const response = await POST(postRequest({ stellarAddress: 'GNEW' }));

    expect(response.status).toBe(400);
    expect(buildOnboardingTransaction).not.toHaveBeenCalled();
  });

  it('builds with the given asset and returns the unsigned transaction', async () => {
    buildOnboardingTransaction.mockResolvedValue({
      partiallySignedXdr: 'AAAAAgAAAAB',
      hashHex: 'ab'.repeat(32),
    });

    const response = await POST(
      postRequest({ stellarAddress: 'GNEW', assetCode: 'USDC', assetIssuer: 'GISSUER' })
    );

    expect(response.status).toBe(200);
    expect(buildOnboardingTransaction).toHaveBeenCalledWith('GNEW', {
      code: 'USDC',
      issuer: 'GISSUER',
    });
  });

  it('surfaces an unconfigured sponsor as a 503', async () => {
    const { SponsorConfigError } = await import('@/lib/onboarding-transaction');
    buildOnboardingTransaction.mockRejectedValue(
      new SponsorConfigError('ZEPHYROUTE_SPONSOR_SECRET_KEY is not configured.')
    );

    const response = await POST(postRequest({ stellarAddress: 'GNEW', assetCode: 'XLM' }));

    expect(response.status).toBe(503);
  });
});
