'use client';

import { useMemo } from 'react';
import { useWallet, type UseWalletResult } from '@/lib/hooks/useWallet';
import {
  useEmbeddedWalletOnboarding,
  type UseEmbeddedWalletOnboardingResult,
} from '@/lib/hooks/useEmbeddedWalletOnboarding';

export type IdentitySource = 'wallet-kit' | 'dfns';
export type IdentityStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface UseActiveIdentityResult {
  address: string | null;
  source: IdentitySource | null;
  /** The DFNS wallet ID behind `address`, set only when `source === 'dfns'`. */
  dfnsWalletId: string | null;
  status: IdentityStatus;
  errorMessage: string | null;
  wallet: UseWalletResult;
  onboarding: UseEmbeddedWalletOnboardingResult;
}

/**
 * Issue #16: the single "who am I, and how was that address obtained"
 * source of truth `useOriginSwap`/`useSettlementStatus`/
 * `useDepositSigning`/the trustline check all read from, instead of
 * each independently reading `useWallet()`'s address directly, gap #1
 * from that issue.
 *
 * A completed DFNS onboarding always takes priority over a connected
 * StellarWalletsKit wallet: the two paths are mutually exclusive in
 * practice (a user either connects an existing wallet or onboards via
 * DFNS in a given session, never usefully both at once), and once DFNS
 * onboarding completes it has already produced a funded, trustlined
 * account ready for the rest of the flow, superseding whatever
 * wallet-kit connection (if any) was active before the user chose the
 * DFNS path instead.
 */
export function useActiveIdentity(): UseActiveIdentityResult {
  const wallet = useWallet();
  const onboarding = useEmbeddedWalletOnboarding();

  return useMemo(() => {
    if (onboarding.status === 'completed' && onboarding.stellarAddress) {
      return {
        address: onboarding.stellarAddress,
        source: 'dfns' as const,
        dfnsWalletId: onboarding.walletId,
        status: 'connected' as const,
        errorMessage: null,
        wallet,
        onboarding,
      };
    }
    return {
      address: wallet.address,
      source: wallet.status === 'connected' ? ('wallet-kit' as const) : null,
      dfnsWalletId: null,
      status: wallet.status,
      errorMessage: wallet.errorMessage,
      wallet,
      onboarding,
    };
  }, [wallet, onboarding]);
}
