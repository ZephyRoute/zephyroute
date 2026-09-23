import { Keypair } from '@stellar/stellar-sdk';

export class InvalidProofError extends Error {}

const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Verified against `@stellar/stellar-sdk`'s own `.d.ts`: the installed
 * 17.1.0 SDK implements SEP-53 message signing/verification natively
 * (`Keypair.signMessage`/`verifyMessage`, `SHA-256("Stellar Signed
 * Message:\n" + message)`), cross-checked against Freighter's own
 * source (`extension/src/helpers/stellar.ts`), which builds the exact
 * same preimage. No hand-rolled hashing here, the SDK's own
 * implementation is the source of truth for the signing scheme.
 *
 * Two distinct prefixes (read vs write, see below), never one shared
 * challenge format: a signed read-proof must never be replayable as a
 * write-authorization or vice versa, a real risk once both exist,
 * closed by construction rather than by convention.
 */
function buildChallenge(prefix: string): string {
  return `${prefix}${Math.floor(Date.now() / 1000)}`;
}

/**
 * Throws `InvalidProofError` on any failure (malformed challenge,
 * wrong prefix, stale timestamp, bad signature), never returns a
 * boolean a caller could accidentally ignore.
 */
function verifyProof(
  prefix: string,
  address: string,
  message: string,
  signatureBase64: string
): void {
  const match = message.match(new RegExp(`^${prefix}(\\d+)$`));
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

const READ_CHALLENGE_PREFIX = 'zephyroute:correlation-read:';

/**
 * Story 1.12, AC #1: closes the enumeration/privacy gap, no lookup by
 * address alone. A fixed, address-agnostic challenge string signed
 * live by the caller's own wallet, the same non-custodial-friendly
 * pattern the rest of this project already uses (nothing ever leaves
 * the wallet extension but a signature).
 */
export function buildCorrelationReadChallenge(): string {
  return buildChallenge(READ_CHALLENGE_PREFIX);
}

export function verifyCorrelationReadProof(
  address: string,
  message: string,
  signatureBase64: string
): void {
  verifyProof(READ_CHALLENGE_PREFIX, address, message, signatureBase64);
}

const WRITE_CHALLENGE_PREFIX = 'zephyroute:correlation-write:';

/**
 * Security review finding: `POST`/`PATCH /api/correlation` previously
 * accepted a write from any caller, no proof that they controlled the
 * `stellarAddress` they were writing a record for. This challenge is
 * that proof: the same SEP-53 signing pattern the read side already
 * uses, a distinct prefix so a read-proof can never be replayed as a
 * write-authorization. This does not prove the settlement/deposit the
 * record describes actually happened (that would need independent
 * server-side reconstruction from Horizon/DeFindex, a larger, separate
 * piece of work), it proves the caller genuinely controls the address
 * the record is filed under, closing the "anyone can forge any
 * address's record" gap specifically.
 */
export function buildCorrelationWriteChallenge(): string {
  return buildChallenge(WRITE_CHALLENGE_PREFIX);
}

export function verifyCorrelationWriteProof(
  address: string,
  message: string,
  signatureBase64: string
): void {
  verifyProof(WRITE_CHALLENGE_PREFIX, address, message, signatureBase64);
}
