'use client';

import { useCallback, useState } from 'react';
import { buildCorrelationReadChallenge } from '@/lib/auth-nonce';

export type CorrelationResumeStatus =
  | 'idle'
  | 'checking'
  | 'resumable-deposit'
  | 'earning'
  | 'none'
  | 'failed';

export interface ResumableDeposit {
  settledAmount: string;
  originChainAsset: string;
}

export interface EarningPosition {
  vaultAddress: string;
  dfTokens: number;
}

export interface UseCorrelationResumeResult {
  status: CorrelationResumeStatus;
  errorMessage: string | null;
  resumableDeposit: ResumableDeposit | null;
  earningPosition: EarningPosition | null;
  check: (address: string, signMessage: (message: string) => Promise<string>) => Promise<void>;
}

/**
 * Story 1.12: on reconnect, signs the fixed challenge (AC #1, closing
 * the enumeration/privacy gap) and asks the gateway what state this
 * address is in, so the caller can resume directly at the
 * deposit-signing step or show the current earning position, never
 * re-quoting or re-signing the origin-chain swap.
 *
 * `signMessage` is `useActiveIdentity`'s own dispatcher (wallet-kit or
 * DFNS), not called directly here, this hook previously only worked
 * for a StellarWalletsKit-connected address, a real, previously
 * unnoticed gap for a DFNS-onboarded identity, closed by taking the
 * dispatcher as a parameter instead of importing wallet-kit directly.
 */
export function useCorrelationResume(): UseCorrelationResumeResult {
  const [status, setStatus] = useState<CorrelationResumeStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resumableDeposit, setResumableDeposit] = useState<ResumableDeposit | null>(null);
  const [earningPosition, setEarningPosition] = useState<EarningPosition | null>(null);

  const check = useCallback(
    async (address: string, signMessage: (message: string) => Promise<string>) => {
      setStatus('checking');
      setErrorMessage(null);
      setResumableDeposit(null);
      setEarningPosition(null);

      const message = buildCorrelationReadChallenge();
      let signature: string;
      try {
        signature = await signMessage(message);
      } catch (cause) {
        setStatus('failed');
        setErrorMessage(cause instanceof Error ? cause.message : 'Could not verify your address.');
        return;
      }

      try {
        const params = new URLSearchParams({ message, signature });
        const response = await fetch(
          `/api/correlation/${encodeURIComponent(address)}?${params.toString()}`
        );
        const payload = await response.json();
        if (!response.ok) {
          setStatus('failed');
          setErrorMessage(payload?.error?.message ?? 'Could not check for an incomplete deposit.');
          return;
        }
        if (payload.status === 'resumable-deposit') {
          setResumableDeposit({
            settledAmount: payload.settledAmount,
            originChainAsset: payload.originChainAsset,
          });
          setStatus('resumable-deposit');
        } else if (payload.status === 'earning') {
          setEarningPosition({ vaultAddress: payload.vaultAddress, dfTokens: payload.dfTokens });
          setStatus('earning');
        } else {
          setStatus('none');
        }
      } catch {
        setStatus('failed');
        setErrorMessage('Could not reach the gateway. Try again.');
      }
    },
    []
  );

  return { status, errorMessage, resumableDeposit, earningPosition, check };
}
