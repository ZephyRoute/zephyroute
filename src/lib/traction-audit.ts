import { findAttributedSettlement } from '@/lib/one-click-client';
import { getDepositorVaultBalance } from '@/lib/defindex-client';

export interface ReconstructedFlow {
  stellarAddress: string;
  originChainAsset: string;
  settledAmountFormatted: string;
  settledAt: string;
  destinationVault: string | null;
  depositStatus: 'completed' | 'not-yet-deposited';
  dfTokens: number;
}

/**
 * Story 3.1, AC #9: reconstructs the same facts the correlation record
 * captures, purely from public/integrator-attributed sources (1Click's
 * own settlement history, DeFindex vault state), deliberately never
 * touching Redis. A project-team verification capability, not part of
 * the live resume flow (Story 1.12): 1Click's history exposes only a
 * human-readable settled amount, never the raw smallest-units figure
 * the deposit-build step needs, so this stays separate rather than
 * risking a silent unit-precision bug if it were wired into that
 * user-facing path instead.
 */
export async function reconstructFlowFromPublicSources(
  stellarAddress: string,
  vaultAddress: string
): Promise<ReconstructedFlow | null> {
  const settlement = await findAttributedSettlement(stellarAddress);
  if (!settlement) return null;

  const balance = await getDepositorVaultBalance(vaultAddress, stellarAddress).catch(() => null);
  const depositStatus: ReconstructedFlow['depositStatus'] =
    balance && balance.dfTokens > 0 ? 'completed' : 'not-yet-deposited';

  return {
    stellarAddress,
    originChainAsset: settlement.originChainAsset,
    settledAmountFormatted: settlement.settledAmountFormatted,
    settledAt: settlement.settledAt,
    destinationVault: depositStatus === 'completed' ? vaultAddress : null,
    depositStatus,
    dfTokens: balance?.dfTokens ?? 0,
  };
}
