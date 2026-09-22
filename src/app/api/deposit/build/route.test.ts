import { describe, expect, it, vi, beforeEach } from 'vitest';

const { buildDepositTransaction } = vi.hoisted(() => ({ buildDepositTransaction: vi.fn() }));

vi.mock('@/lib/defindex-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/defindex-client')>(
    '@/lib/defindex-client'
  );
  return { ...actual, buildDepositTransaction };
});

const { POST } = await import('./route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/deposit/build', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/deposit/build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed JSON with a 400, never reaching buildDepositTransaction', async () => {
    const response = await POST(
      new Request('http://localhost/api/deposit/build', { method: 'POST', body: 'not json' })
    );

    expect(response.status).toBe(400);
    expect(buildDepositTransaction).not.toHaveBeenCalled();
  });

  it('rejects a body missing required fields with a 400', async () => {
    const response = await POST(postRequest({ depositorAddress: 'GDEPOSITOR' }));

    expect(response.status).toBe(400);
    expect(buildDepositTransaction).not.toHaveBeenCalled();
  });

  it('returns the built xdr and vault address on success', async () => {
    buildDepositTransaction.mockResolvedValue({ xdr: 'AAAAAgAAAAB', vaultAddress: 'CVAULT' });

    const response = await POST(
      postRequest({ depositorAddress: 'GDEPOSITOR', amountInSmallestUnits: '10000000' })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ xdr: 'AAAAAgAAAAB', vaultAddress: 'CVAULT' });
    expect(buildDepositTransaction).toHaveBeenCalledWith('GDEPOSITOR', '10000000', undefined);
  });

  it('passes through a caller-specified slippageBps', async () => {
    buildDepositTransaction.mockResolvedValue({ xdr: 'AAAAAgAAAAB', vaultAddress: 'CVAULT' });

    await POST(
      postRequest({
        depositorAddress: 'GDEPOSITOR',
        amountInSmallestUnits: '10000000',
        slippageBps: 250,
      })
    );

    expect(buildDepositTransaction).toHaveBeenCalledWith('GDEPOSITOR', '10000000', 250);
  });

  it('wraps a build failure as a 502 DEPOSIT_BUILD_FAILED envelope, never a raw cause', async () => {
    const { DepositBuildError } = await import('@/lib/defindex-client');
    buildDepositTransaction.mockRejectedValue(new DepositBuildError('DEFINDEX_VAULT_ADDRESS is not configured.'));

    const response = await POST(
      postRequest({ depositorAddress: 'GDEPOSITOR', amountInSmallestUnits: '10000000' })
    );

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('DEPOSIT_BUILD_FAILED');
  });
});
