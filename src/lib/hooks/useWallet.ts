'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  connectWallet,
  disconnectWallet,
  onWalletDisconnected,
  WalletConnectionError,
} from '@/lib/wallet-kit';

export type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface UseWalletResult {
  address: string | null;
  status: WalletConnectionState;
  errorMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * The connected address is the sole identifier used for balance
 * detection and deposit signing later in the flow (Story 1.4 AC).
 * A cancelled or failed connection surfaces explicitly through
 * `status`/`errorMessage`, it never retries silently (AC #5).
 */
export function useWallet(): UseWalletResult {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return onWalletDisconnected(() => {
      setAddress(null);
      setStatus('disconnected');
    });
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);
    try {
      const connectedAddress = await connectWallet();
      setAddress(connectedAddress);
      setStatus('connected');
    } catch (error) {
      setStatus('failed');
      setAddress(null);
      setErrorMessage(
        error instanceof WalletConnectionError
          ? error.message
          : 'Something went wrong connecting your wallet. Try again.'
      );
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    setStatus('disconnected');
  }, []);

  return { address, status, errorMessage, connect, disconnect };
}
