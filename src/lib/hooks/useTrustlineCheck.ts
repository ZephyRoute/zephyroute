'use client';

import { useCallback, useState } from 'react';
import { hasTrustline, type AssetIdentifier } from '@/lib/horizon';

export type TrustlineCheckState = 'idle' | 'checking' | 'present' | 'missing' | 'failed';

export interface UseTrustlineCheckResult {
  status: TrustlineCheckState;
  errorMessage: string | null;
  check: (accountId: string, asset: AssetIdentifier) => Promise<boolean>;
}

/**
 * Runs before the quote request fires, never after (FR3, Integration
 * Coupling Map). A missing trustline routes into onboarding (FR6)
 * instead of letting an opaque 1Click rejection be the first signal.
 */
export function useTrustlineCheck(): UseTrustlineCheckResult {
  const [status, setStatus] = useState<TrustlineCheckState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const check = useCallback(async (accountId: string, asset: AssetIdentifier) => {
    setStatus('checking');
    setErrorMessage(null);
    try {
      const present = await hasTrustline(accountId, asset);
      setStatus(present ? 'present' : 'missing');
      return present;
    } catch (error) {
      setStatus('failed');
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not check your Stellar account.'
      );
      return false;
    }
  }, []);

  return { status, errorMessage, check };
}
