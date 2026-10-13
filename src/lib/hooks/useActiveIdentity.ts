'use client';

import { useCallback, useMemo } from 'react';
import { useWallet, type UseWalletResult } from '@/lib/hooks/useWallet';
import {
  useEmbeddedWalletOnboarding,
  type UseEmbeddedWalletOnboardingResult,
} from '@/lib/hooks/useEmbeddedWalletOnboarding';
import { signChallengeMessage } from '@/lib/wallet-kit';

export type IdentitySource = 'wallet-kit' | 'dfns';
export type IdentityStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

export class NoActiveIdentityError extends Error {}

export interface UseActiveIdentityResult {
  address: string | null;
  source: IdentitySource | null;
  /** The DFNS wallet ID behind `address`, set only when `source === 'dfns'`. */
  dfnsWalletId: string | null;
  status: IdentityStatus;
  errorMessage: string | null;
  wallet: UseWalletResult;
  onboarding: UseEmbeddedWalletOnboardingResult;
  /**
   * Security review follow-on: signs a SEP-53 challenge message (never
   * a transaction) with whichever signing capability actually holds
   * `address`'s key, dispatching by `source` exactly like
   * `useDepositSigning`'s deposit-signing dispatch already does.
   * Callers (the correlation read/write proofs) never need to know or
   * branch on which path is active.
   */
  signMessage: (message: string) => Promise<string>;
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

  const isDfns = onboarding.status === 'completed' && !!onboarding.stellarAddress;
  const address = isDfns ? onboarding.stellarAddress : wallet.address;
  const dfnsWalletId = isDfns ? onboarding.walletId : null;
  const source: IdentitySource | null = isDfns ? 'dfns' : wallet.status === 'connected' ? 'wallet-kit' : null;

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!address || !source) {
        throw new NoActiveIdentityError('No connected wallet or onboarded account to sign with.');
      }
      if (source === 'dfns') {
        if (!dfnsWalletId) {
          throw new NoActiveIdentityError('Missing DFNS wallet ID for the active identity.');
        }
        const { signMessageWithDfns } = await import('@/lib/dfns-message-signing');
        return signMessageWithDfns(dfnsWalletId, message);
      }
      return signChallengeMessage(address, message);
    },
    [address, source, dfnsWalletId]
  );

  return useMemo(() => {
    if (isDfns) {
      return {
        address,
        source: 'dfns' as const,
        dfnsWalletId,
        status: 'connected' as const,
        errorMessage: null,
        wallet,
        onboarding,
        signMessage,
      };
    }
    return {
      address: wallet.address,
      source,
      dfnsWalletId: null,
      status: wallet.status,
      errorMessage: wallet.errorMessage,
      wallet,
      onboarding,
      signMessage,
    };
  }, [isDfns, address, dfnsWalletId, source, wallet, onboarding, signMessage]);
}
