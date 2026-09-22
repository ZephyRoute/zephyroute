'use client';

import { useCallback, useState } from 'react';
import { createPasskeyCredential, signWithPasskey, PasskeyError } from '@/lib/dfns-passkey';
import type { AssetIdentifier } from '@/lib/horizon';

export type OnboardingStatus =
  | 'idle'
  | 'registering'
  | 'funding'
  | 'signing'
  | 'submitting'
  | 'completed'
  | 'failed';

export interface UseEmbeddedWalletOnboardingResult {
  status: OnboardingStatus;
  errorMessage: string | null;
  stellarAddress: string | null;
  onboard: (email: string, asset: AssetIdentifier) => Promise<string | null>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Something went wrong. Try again.');
  }
  return payload as T;
}

/**
 * Story 2.2: orchestrates the full onboarding flow end to end, a
 * passkey registration (AC #3) that creates a non-custodial Stellar
 * wallet, then a sponsored account+trustline creation (AC #1/#2)
 * signed by that same passkey, never a private key Zephyroute ever
 * sees. Every step that touches a DFNS or treasury secret goes through
 * a server route, never called directly (the same discipline Issues
 * #3/#7 established for 1Click, DeFindex, and Redis).
 */
export function useEmbeddedWalletOnboarding(): UseEmbeddedWalletOnboardingResult {
  const [status, setStatus] = useState<OnboardingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stellarAddress, setStellarAddress] = useState<string | null>(null);

  const onboard = useCallback(async (email: string, asset: AssetIdentifier) => {
    setStatus('registering');
    setErrorMessage(null);

    try {
      const externalId = crypto.randomUUID();
      const challenge = await postJson<Record<string, unknown>>(
        '/api/onboarding/register/challenge',
        { email, externalId }
      );
      const attestation = await createPasskeyCredential(challenge as never);
      const registered = await postJson<{ walletId: string; stellarAddress: string }>(
        '/api/onboarding/register/complete',
        { firstFactorCredential: attestation, walletName: 'zephyroute-stellar' }
      );

      setStatus('funding');
      const built = await postJson<{ partiallySignedXdr: string; hashHex: string }>(
        '/api/onboarding/fund/build',
        {
          stellarAddress: registered.stellarAddress,
          assetCode: asset.code,
          assetIssuer: asset.issuer,
        }
      );

      setStatus('signing');
      const signInitChallenge = await postJson<{ challengeIdentifier: string }>(
        '/api/onboarding/fund/sign-init',
        { walletId: registered.walletId, hashHex: built.hashHex }
      );
      const assertion = await signWithPasskey(signInitChallenge as never);

      setStatus('submitting');
      const submitted = await postJson<{ hash: string; successful: boolean }>(
        '/api/onboarding/fund/sign-complete',
        {
          walletId: registered.walletId,
          hashHex: built.hashHex,
          signedChallenge: {
            challengeIdentifier: signInitChallenge.challengeIdentifier,
            firstFactor: assertion,
          },
          partiallySignedXdr: built.partiallySignedXdr,
          stellarAddress: registered.stellarAddress,
        }
      );

      if (!submitted.successful) {
        setStatus('failed');
        setErrorMessage('Account setup was rejected on-chain. Try again.');
        return null;
      }

      setStellarAddress(registered.stellarAddress);
      setStatus('completed');
      return registered.stellarAddress;
    } catch (cause) {
      setStatus('failed');
      setErrorMessage(
        cause instanceof PasskeyError || cause instanceof Error
          ? cause.message
          : 'Account setup failed. Try again.'
      );
      return null;
    }
  }, []);

  return { status, errorMessage, stellarAddress, onboard };
}
