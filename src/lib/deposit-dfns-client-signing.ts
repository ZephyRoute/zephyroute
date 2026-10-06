import { signWithPasskey, PasskeyError } from '@/lib/dfns-passkey';

export class DfnsDepositSigningError extends Error {}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new DfnsDepositSigningError(payload?.error?.message ?? 'Could not sign the deposit.');
  }
  return payload as T;
}

/**
 * Issue #16, gap #2: signs and submits the deposit transaction via a
 * DFNS-onboarded depositor's passkey, the counterpart to
 * `wallet-kit.ts`'s `signDepositTransaction` for a StellarWalletsKit
 * depositor. Mirrors `useEmbeddedWalletOnboarding.ts`'s own
 * sign-init/passkey-assertion/sign-complete sequence, the identical
 * three-step dance DFNS requires for any wallet signature, not just an
 * onboarding one.
 */
export async function signAndSubmitDepositWithDfns(
  unsignedXdr: string,
  transactionHashHex: string,
  walletId: string,
  depositorAddress: string
): Promise<{ hash: string; successful: boolean }> {
  try {
    const signInitChallenge = await postJson<{ challengeIdentifier: string }>(
      '/api/deposit/sign-init',
      { walletId, hashHex: transactionHashHex }
    );
    const assertion = await signWithPasskey(signInitChallenge as never);

    return await postJson<{ hash: string; successful: boolean }>('/api/deposit/sign-complete', {
      walletId,
      hashHex: transactionHashHex,
      signedChallenge: {
        challengeIdentifier: signInitChallenge.challengeIdentifier,
        firstFactor: assertion,
      },
      unsignedXdr,
      depositorAddress,
    });
  } catch (cause) {
    if (cause instanceof DfnsDepositSigningError) throw cause;
    if (cause instanceof PasskeyError) {
      throw new DfnsDepositSigningError(cause.message, { cause });
    }
    throw new DfnsDepositSigningError('Could not sign the deposit. Try again.', { cause });
  }
}
