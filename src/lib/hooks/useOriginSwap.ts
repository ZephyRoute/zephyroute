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

  const signAndSubmit = useCallback(
    async (route: SupportedRoute, depositAddress: string, amountInSmallestUnits: string) => {
      setErrorMessage(null);
      try {
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
        const hash = await sendTransactionAsync(tx);
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
    [isConnected, connectors, connectAsync, sendTransactionAsync]
  );

  return { status, errorMessage, txHash, evmAddress, signAndSubmit };
}
