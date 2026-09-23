import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getDepositorVaultBalance } = vi.hoisted(() => ({ getDepositorVaultBalance: vi.fn() }));

vi.mock('@/lib/defindex-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/defindex-client')>(
    '@/lib/defindex-client'
  );
  return { ...actual, getDepositorVaultBalance };
});

const { GET } = await import('./route');

function getRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/deposit/balance');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url);
}

describe('GET /api/deposit/balance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request missing vaultAddress or depositorAddress with a 400', async () => {
    const response = await GET(getRequest({ vaultAddress: 'CVAULT' }));

    expect(response.status).toBe(400);
    expect(getDepositorVaultBalance).not.toHaveBeenCalled();
  });

  it('returns the balance on success', async () => {
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 100, underlyingBalance: [9900000] });

    const response = await GET(getRequest({ vaultAddress: 'CVAULT', depositorAddress: 'GDEPOSITOR' }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ dfTokens: 100, underlyingBalance: [9900000] });
  });

  it('wraps a query failure as a 502 envelope, never a raw cause', async () => {
    const { VaultBalanceQueryError } = await import('@/lib/defindex-client');
    getDepositorVaultBalance.mockRejectedValue(new VaultBalanceQueryError('DeFindex is down'));

    const response = await GET(getRequest({ vaultAddress: 'CVAULT', depositorAddress: 'GDEPOSITOR' }));

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('VAULT_BALANCE_QUERY_FAILED');
  });
});
