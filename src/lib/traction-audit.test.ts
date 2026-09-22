import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findAttributedSettlement, getDepositorVaultBalance } = vi.hoisted(() => ({
  findAttributedSettlement: vi.fn(),
  getDepositorVaultBalance: vi.fn(),
}));

vi.mock('@/lib/one-click-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/one-click-client')>(
    '@/lib/one-click-client'
  );
  return { ...actual, findAttributedSettlement };
});
vi.mock('@/lib/defindex-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/defindex-client')>(
    '@/lib/defindex-client'
  );
  return { ...actual, getDepositorVaultBalance };
});

const { reconstructFlowFromPublicSources } = await import('./traction-audit');

/**
 * Story 3.1, AC #9: "the same record can be independently reconstructed
 * from public sources alone... verified by deliberately discarding the
 * Redis record for a test flow and confirming the fallback query
 * produces the same result."
 */
describe('reconstructFlowFromPublicSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconstructs a completed flow purely from 1Click history + DeFindex, matching the original correlation record with no Redis involved', async () => {
    // The record Story 1.8/1.11 would have written to Redis for this
    // flow, for comparison; Redis is never touched by this function.
    const originalRecord = {
      stellarAddress: 'GDEPOSITOR',
      originChainAsset: 'nep141:eth.origin',
      settledAmount: '9969000',
      settledAt: '2026-09-22T00:05:00Z',
      integratorId: 'zephyroute',
      correlationId: 'corr-1',
      destinationVault: 'CVAULT',
      depositStatus: 'completed' as const,
      depositConfirmedAt: '2026-09-22T00:10:00Z',
    };

    // Stellar fixes every classic/SAC asset's precision at 7 decimals
    // at the protocol level (not implementation-specific), matching
    // `DepositSigningPanel.tsx`'s own `STELLAR_DECIMALS` constant.
    findAttributedSettlement.mockResolvedValue({
      originChainAsset: originalRecord.originChainAsset,
      settledAmountFormatted: '0.9969000 USDC',
      settledAt: originalRecord.settledAt,
    });
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 100, underlyingBalance: [9969000] });

    const reconstructed = await reconstructFlowFromPublicSources('GDEPOSITOR', 'CVAULT');

    expect(reconstructed).not.toBeNull();
    expect(reconstructed!.stellarAddress).toBe(originalRecord.stellarAddress);
    expect(reconstructed!.originChainAsset).toBe(originalRecord.originChainAsset);
    expect(reconstructed!.settledAt).toBe(originalRecord.settledAt);
    expect(reconstructed!.destinationVault).toBe(originalRecord.destinationVault);
    expect(reconstructed!.depositStatus).toBe('completed');
    // The reconstructed amount is a different, honestly-labeled
    // representation (human-readable, no raw smallest-units field
    // exists in 1Click's history), so compared numerically after unit
    // conversion, never by string equality.
    const rawAsDecimal = Number(originalRecord.settledAmount) / 1e7;
    const reconstructedAsDecimal = parseFloat(reconstructed!.settledAmountFormatted);
    expect(reconstructedAsDecimal).toBeCloseTo(rawAsDecimal, 3);
  });

  it('reconstructs a not-yet-deposited flow as such, never fabricating a completed status', async () => {
    findAttributedSettlement.mockResolvedValue({
      originChainAsset: 'nep141:eth.origin',
      settledAmountFormatted: '9.969 USDC',
      settledAt: '2026-09-22T00:05:00Z',
    });
    getDepositorVaultBalance.mockResolvedValue({ dfTokens: 0, underlyingBalance: [0] });

    const reconstructed = await reconstructFlowFromPublicSources('GDEPOSITOR', 'CVAULT');

    expect(reconstructed!.depositStatus).toBe('not-yet-deposited');
    expect(reconstructed!.destinationVault).toBeNull();
  });

  it('returns null when no attributed settlement is found, never fabricating a flow that never happened', async () => {
    findAttributedSettlement.mockResolvedValue(null);

    expect(await reconstructFlowFromPublicSources('GUNKNOWN', 'CVAULT')).toBeNull();
  });

  it('treats a DeFindex outage as not-yet-deposited rather than failing the whole reconstruction', async () => {
    findAttributedSettlement.mockResolvedValue({
      originChainAsset: 'nep141:eth.origin',
      settledAmountFormatted: '9.969 USDC',
      settledAt: '2026-09-22T00:05:00Z',
    });
    getDepositorVaultBalance.mockRejectedValue(new Error('DeFindex is down'));

    const reconstructed = await reconstructFlowFromPublicSources('GDEPOSITOR', 'CVAULT');

    expect(reconstructed!.depositStatus).toBe('not-yet-deposited');
  });
});
