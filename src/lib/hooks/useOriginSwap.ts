'use client';

import { useCallback, useState } from 'react';
import { buildOriginSwapTransaction } from '@/lib/origin-swap';
import type { SupportedRoute } from '@/lib/routes';

export type OriginSwapState = 'idle' | 'connecting' | 'signing' | 'submitted' | 'failed';

/**
 * Wraps wagmi's connect/send-transaction flow for the origin-chain
 * signature (Story 1.8). The gateway never sees a private key here
 * either, `injected()` talks directly to the browser wallet extension.
 *
 * Issue #57: wagmi/viem are dynamically imported, same as the Solana
 * stack below, rather than via `WagmiProvider`'s React hooks (which
 * would require loading and mounting the whole wagmi/viem stack at the
 * app root for every session regardless of which origin chain, if any,
 * a user ends up choosing). `wagmi/actions` (re-exporting
 * `@wagmi/core/actions`) exposes the same connect/account/send
 * operations as plain functions over an explicit `config` object, with
 * no React Context requirement.
 */
export function useOriginSwap() {
  const [status, setStatus] = useState<OriginSwapState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const signAndSubmitSolana = useCallback(
    async (route: SupportedRoute, depositAddress: string, amountInSmallestUnits: string) => {
      // Dynamically imported: Solana's web3.js/spl-token/wallet-standard
      // stack is a real, meaningful chunk of bundle weight (the same
      // Issue #25 lesson already applied to the DFNS SDK), only worth
      // loading for a session that actually selects a Solana route,
      // never at module load time for every session regardless.
      const [{ connectSolanaWallet, signAndSendSolanaTransaction }, { buildSolanaSwapTransaction }] =
        await Promise.all([import('@/lib/solana-wallet'), import('@/lib/solana-swap')]);

      setStatus('connecting');
      const account = await connectSolanaWallet();

      setStatus('signing');
      const serializedTransaction = await buildSolanaSwapTransaction(
        route,
        account.address,
        depositAddress,
        amountInSmallestUnits
      );
      const signature = await signAndSendSolanaTransaction(account, serializedTransaction);
      setTxHash(signature);
      setStatus('submitted');
      return signature;
    },
    []
  );

  const signAndSubmit = useCallback(
    async (route: SupportedRoute, depositAddress: string, amountInSmallestUnits: string) => {
      setErrorMessage(null);
      try {
        if (route.originChain === 'solana') {
          return await signAndSubmitSolana(route, depositAddress, amountInSmallestUnits);
        }

        const [{ wagmiConfig }, { connect, getConnection, getConnectors, sendTransaction }] =
          await Promise.all([import('@/lib/wagmi-config'), import('wagmi/actions')]);

        if (!getConnection(wagmiConfig).isConnected) {
          setStatus('connecting');
          const connector = getConnectors(wagmiConfig)[0];
          if (!connector) {
            throw new Error('No EVM wallet extension detected.');
          }
          await connect(wagmiConfig, { connector });
        }

        setStatus('signing');
        const tx = buildOriginSwapTransaction(route, depositAddress, amountInSmallestUnits);
        // route.chainId (PRD Open Question 3 follow-on fix): without
        // it, the transaction submits on whatever chain the wallet
        // already happens to be connected to, not necessarily the
        // selected route's chain, a real correctness gap once more
        // than one EVM chain is offered. Passing it lets wagmi prompt
        // a chain switch first when the wallet isn't already there.
        // `route.chainId` stays a plain `number` in routes.ts (some
        // routes, e.g. Bitcoin, leave it undefined), but by this point
        // `buildOriginSwapTransaction` has already thrown for Bitcoin
        // and Solana branched off above, so it's always one of
        // `wagmiConfig`'s three configured chain IDs here.
        const hash = await sendTransaction(wagmiConfig, {
          ...tx,
          chainId: route.chainId as (typeof wagmiConfig.chains)[number]['id'],
        });
        setTxHash(hash);
        setStatus('submitted');
        return hash;
      } catch (error) {
        setStatus('failed');
        setErrorMessage(
          error instanceof Error ? error.message : 'The origin-chain signature failed or was cancelled.'
        );
        throw error;
      }
    },
    [signAndSubmitSolana]
  );

  return { status, errorMessage, txHash, signAndSubmit };
}
