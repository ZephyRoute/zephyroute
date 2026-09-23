'use client';

import { useCallback, useState } from 'react';
import { useAccount, useConnect, useSendTransaction } from 'wagmi';
import { buildOriginSwapTransaction } from '@/lib/origin-swap';
import type { SupportedRoute } from '@/lib/routes';

export type OriginSwapState = 'idle' | 'connecting' | 'signing' | 'submitted' | 'failed';

/**
 * Wraps wagmi's connect/send-transaction flow for the origin-chain
 * signature (Story 1.8). The gateway never sees a private key here
 * either, `injected()` talks directly to the browser wallet extension.
 */
export function useOriginSwap() {
  const { address: evmAddress, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { sendTransactionAsync } = useSendTransaction();
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

        if (!isConnected) {
          setStatus('connecting');
          const connector = connectors[0];
          if (!connector) {
            throw new Error('No EVM wallet extension detected.');
          }
          await connectAsync({ connector });
        }

        setStatus('signing');
        const tx = buildOriginSwapTransaction(route, depositAddress, amountInSmallestUnits);
        // route.chainId (PRD Open Question 3 follow-on fix): without
        // it, the transaction submits on whatever chain the wallet
        // already happens to be connected to, not necessarily the
        // selected route's chain, a real correctness gap once more
        // than one EVM chain is offered. Passing it lets wagmi prompt
        // a chain switch first when the wallet isn't already there.
        const hash = await sendTransactionAsync({ ...tx, chainId: route.chainId });
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
    [isConnected, connectors, connectAsync, sendTransactionAsync, signAndSubmitSolana]
  );

  return { status, errorMessage, txHash, evmAddress, signAndSubmit };
}
