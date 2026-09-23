import { describe, expect, it, vi, beforeEach } from 'vitest';

const { verifyCorrelationReadProof, getDepositorVaultBalance, requiredVaultAddress, redisGet } =
  vi.hoisted(() => ({
    verifyCorrelationReadProof: vi.fn(),
    getDepositorVaultBalance: vi.fn(),
    requiredVaultAddress: vi.fn(),
    redisGet: vi.fn(),
  }));

vi.mock('@/lib/auth-nonce', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-nonce')>('@/lib/auth-nonce');
  return { ...actual, verifyCorrelationReadProof };
});
vi.mock('@/lib/defindex-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/defindex-client')>(
    '@/lib/defindex-client'
  );
  return { ...actual, getDepositorVaultBalance, requiredVaultAddress };
});
vi.mock('@/lib/redis', () => ({ getRedisClient: () => ({ get: redisGet }) }));

const { GET } = await import('./route');

function getRequest(address: string, params: Record<string, string> = {}): {
  request: Request;
  context: { params: Promise<{ address: string }> };
} {
  const url = new URL('http://localhost/api/correlation/x');
  for (const [key, value] of Object.entries({
    message: 'zephyroute:correlation-read:1758499200',
    signature: 'sig',
    ...params,
  })) {
    url.searchParams.set(key, value);
  }
  return { request: new Request(url), context: { params: Promise.resolve({ address }) } };
}

describe('GET /api/correlation/[address]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requiredVaultAddress.mockReturnValue('CDEFAULTVAULT');
  });

  it('rejects a request missing message or signature with a 400, never reaching verification', async () => {
    const { request, context } = getRequest('GDEPOSITOR', { message: '' });

    const response = await GET(request, context);

    expect(response.status).toBe(400);
    expect(verifyCorrelationReadProof).not.toHaveBeenCalled();
  });

  it('rejects an invalid proof with a 401, closing the enumeration gap (AC #1)', async () => {
    const { InvalidProofError } = await import('@/lib/auth-nonce');
    verifyCorrelationReadProof.mockImplementation(() => {
      throw new InvalidProofError('bad signature');
    });
    const { request, context } = getRequest('GDEPOSITOR');

    const response = await GET(request, context);

    expect(response.status).toBe(401);
    expect(redisGet).not.toHaveBeenCalled();
  });

  it('resumes directly at the deposit-signing step when settled but not yet deposited', async () => {
    verifyCorrelationReadProof.mockReturnValue(undefined);
    redisGet.mockResolvedValue({
      stellarAddress: 'GDEPOSITOR',
      originChainAsset: 'nep141:eth.origin',
      settledAmount: '10000000',
      settledAt: '2026-09-22T00:00:00Z',
      integratorId: 'zephyroute',
      correlationId: 'abc',
    });
    const { request, context } = getRequest('GDEPOSITOR');

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      status: 'resumable-deposit',
      settledAmount: '10000000',
      originChainAsset: 'nep141:eth.origin',
    });
  });

  it('reports the current earning position when the correlation record already shows a completed deposit', async () => {
    verifyCorrelationReadProof.mockReturnValue(undefined);
    redisGet.mockResolvedValue({
      stellarAddress: 'GDEPOSITOR',
      originChainAsset: 'nep141:eth.origin',
      settledAmount: '10000000',
      settledAt: '2026-09-22T00:00:00Z',
      integratorId: 'zephyroute',
      correlationId: 'abc',
      destinationVault: 'CVAULT',
      depositStatus: 'completed',
      depositConfirmedAt: '2026-09-22T00:05:00Z',
    });
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 100, underlyingBalance: [] });
    const { request, context } = getRequest('GDEPOSITOR');

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ status: 'earning', vaultAddress: 'CVAULT', dfTokens: 100 });
  });

  it('falls back to a direct DeFindex balance check when Redis has no record, reporting earning if dfTokens > 0 (AC #9)', async () => {
    verifyCorrelationReadProof.mockReturnValue(undefined);
    redisGet.mockResolvedValue(null);
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 50, underlyingBalance: [] });
    const { request, context } = getRequest('GDEPOSITOR');

    const response = await GET(request, context);

    const payload = await response.json();
    expect(payload).toEqual({ status: 'earning', vaultAddress: 'CDEFAULTVAULT', dfTokens: 50 });
  });

  it('reports none rather than fabricating a resume state when there is no record and no vault balance', async () => {
    verifyCorrelationReadProof.mockReturnValue(undefined);
    redisGet.mockResolvedValue(null);
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 0, underlyingBalance: [] });
    const { request, context } = getRequest('GDEPOSITOR');

    const response = await GET(request, context);

    const payload = await response.json();
    expect(payload).toEqual({ status: 'none' });
  });

  it('falls back to the direct query rather than erroring when Redis itself is unavailable, per Rule #9', async () => {
    verifyCorrelationReadProof.mockReturnValue(undefined);
    redisGet.mockRejectedValue(new Error('ECONNREFUSED'));
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 0, underlyingBalance: [] });
    const { request, context } = getRequest('GDEPOSITOR');

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ status: 'none' });
  });
});
