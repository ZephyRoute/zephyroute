'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetBalance, type AssetIdentifier } from '@/lib/horizon';

export interface UseSettlementStatusParams {
  accountId: string;
  asset: AssetIdentifier;
  /** The balance already observed before this settlement, so arrival
   * is detected as an increase, not just "any balance present". */
  baselineBalance: string;
  enabled: boolean;
}

/**
 * FR4: settlement detection is a TanStack Query polling model
 * (architecture.md, Communication Patterns), based on the user's
 * actual Stellar account balance via Horizon, never solely on 1Click's
 * own status field. Every 5s is a deliberately short interval since
 * the fastest confirmed routes settle in 40-60s (addendum.md §E);
 * BTC's ~14min route still gets timely updates without hammering
 * Horizon disproportionately for the common case.
 */
export function useSettlementStatus({
  accountId,
  asset,
  baselineBalance,
  enabled,
}: UseSettlementStatusParams) {
  const query = useQuery({
    queryKey: ['settlement-status', accountId, asset.code, asset.issuer ?? 'native'],
    queryFn: () => getAssetBalance(accountId, asset),
    enabled,
    refetchInterval: (result) => {
      const current = result.state.data;
      if (current && current.balance !== baselineBalance) return false;
      return 5000;
    },
  });

  const settled = Boolean(query.data && query.data.balance !== baselineBalance);

  return {
    settled,
    settledAt: settled ? query.data?.lastModifiedTime : undefined,
    isPolling: query.isFetching || (enabled && !settled),
    error: query.error,
  };
}
