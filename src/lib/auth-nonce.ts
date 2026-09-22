import { Keypair } from '@stellar/stellar-sdk';

export class InvalidProofError extends Error {}

const CHALLENGE_PREFIX = 'zephyroute:correlation-read:';
const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Story 1.12, AC #1: closes the enumeration/privacy gap, no lookup by
 * address alone. A fixed, address-agnostic challenge string signed
 * live by the caller's own wallet, the same non-custodial-friendly
 * pattern the rest of this project already uses (nothing ever leaves
 * the wallet extension but a signature).
 */
export function buildCorrelationReadChallenge(): string {
  return `${CHALLENGE_PREFIX}${Math.floor(Date.now() / 1000)}`;
}

/**
 * Verified against `@stellar/stellar-sdk`'s own `.d.ts`: the installed
 * 17.1.0 SDK implements SEP-53 message signing/verification natively
 * (`Keypair.verifyMessage`), cross-checked against Freighter's own
 * source (`extension/src/helpers/stellar.ts`), which builds the exact
 * same `"Stellar Signed Message:\n" + message` SHA-256 preimage. No
 * hand-rolled hashing here, the SDK's own implementation is the
 * source of truth for the signing scheme.
 *
 * Throws `InvalidProofError` on any failure (malformed challenge,
 * stale timestamp, bad signature), never returns a boolean a caller
 * could accidentally ignore.
 */
export function verifyCorrelationReadProof(
  address: string,
  message: string,
  signatureBase64: string
): void {
  const match = message.match(new RegExp(`^${CHALLENGE_PREFIX}(\\d+)$`));
  if (!match) {
    throw new InvalidProofError('Challenge string does not match the expected format.');
  }

  const timestamp = Number(match[1]);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    throw new InvalidProofError('Challenge has expired. Sign a fresh challenge and try again.');
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = Uint8Array.from(Buffer.from(signatureBase64, 'base64'));
  } catch {
    throw new InvalidProofError('Signature is not valid base64.');
  }

  let verified: boolean;
  try {
    verified = Keypair.fromPublicKey(address).verifyMessage(message, signatureBytes);
  } catch {
    throw new InvalidProofError('Could not verify this signature against the given address.');
  }

  if (!verified) {
    throw new InvalidProofError('Signature does not match the challenge and address.');
  }
}
