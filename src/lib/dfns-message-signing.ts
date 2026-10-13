import { signWithPasskey, PasskeyError } from '@/lib/dfns-passkey';

export class DfnsMessageSigningError extends Error {}

/**
 * The exact SEP-53 preimage construction `@stellar/stellar-sdk`'s own
 * `Keypair.signMessage`/`verifyMessage` use internally
 * (`SHA-256("Stellar Signed Message:\n" + message)`), independently
 * verified before writing this: manually hashing this way and signing
 * the raw hash directly (bypassing `signMessage` entirely, the same
 * shape a DFNS `kind: 'Hash'` MPC signature produces) was confirmed to
 * verify correctly via the SDK's own `Keypair.verifyMessage`. No
 * server secret or private key touches this computation, it runs
 * entirely client-side over a public challenge string.
 */
const SEP53_MESSAGE_PREFIX = 'Stellar Signed Message:\n';

async function sep53HashHex(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(SEP53_MESSAGE_PREFIX + message);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new DfnsMessageSigningError(payload?.error?.message ?? 'Could not sign the challenge.');
  }
  return payload as T;
}

/**
 * Security review follow-on: the DFNS-onboarded counterpart to
 * `wallet-kit.ts`'s `signChallengeMessage`, so a correlation read/write
 * challenge (`lib/auth-nonce.ts`) can be signed by a depositor whose
 * key lives in DFNS's MPC infrastructure, not a StellarWalletsKit
 * wallet. Returns the same base64-encoded signature shape
 * `verifyCorrelationReadProof`/`verifyCorrelationWriteProof` already
 * expect from the wallet-kit path, so the server-side verification
 * needs no branching by signing source.
 */
export async function signMessageWithDfns(walletId: string, message: string): Promise<string> {
  try {
    const hashHex = await sep53HashHex(message);

    const signInitChallenge = await postJson<{ challengeIdentifier: string }>(
      '/api/correlation-auth/sign-init',
      { walletId, hashHex }
    );
    const assertion = await signWithPasskey(signInitChallenge as never);

    const { signature } = await postJson<{ signature: string }>(
      '/api/correlation-auth/sign-complete',
      {
        walletId,
        hashHex,
        signedChallenge: {
          challengeIdentifier: signInitChallenge.challengeIdentifier,
          firstFactor: assertion,
        },
      }
    );
    return signature;
  } catch (cause) {
    if (cause instanceof DfnsMessageSigningError) throw cause;
    if (cause instanceof PasskeyError) {
      throw new DfnsMessageSigningError(cause.message, { cause });
    }
    throw new DfnsMessageSigningError('Could not sign the challenge. Try again.', { cause });
  }
}
