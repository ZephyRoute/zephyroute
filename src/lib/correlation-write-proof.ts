import { buildCorrelationWriteChallenge } from '@/lib/auth-nonce';

interface CachedWriteProof {
  address: string;
  message: string;
  signature: string;
  issuedAtSeconds: number;
}

/**
 * `auth-nonce.ts`'s own `MAX_CLOCK_SKEW_SECONDS`, the server-side
 * validity window a signed write-proof is checked against. Duplicated
 * here rather than imported since `auth-nonce.ts` doesn't export it;
 * kept in sync manually, the same tradeoff the file's own SEP-53
 * comment already accepts for the signing scheme itself.
 */
const PROOF_VALIDITY_SECONDS = 300;

/**
 * Kept clear of the real expiry so a reused proof is never handed to a
 * caller close enough to the boundary that request latency could push
 * it past the server's own check.
 */
const REUSE_MARGIN_SECONDS = 30;

let cached: CachedWriteProof | null = null;

/**
 * PR #43 / Issue #41's own flagged tradeoff, mitigation (b): the
 * settlement-detection write (`ZephyrouteFlow`'s correlation POST) and
 * the deposit-completion write (`useDepositSigning`'s correlation
 * PATCH) each independently required a fresh signed
 * `zephyroute:correlation-write:` challenge, two new prompts where none
 * existed before, against the "two signatures" framing already used in
 * the product's own PRD, UX spec, and Interest Form draft. Both writes
 * authorize the same address for the same flow, normally seconds to a
 * few minutes apart, so reusing one proof across both, as long as it's
 * still within its server-side validity window, collapses that back
 * down to at most one new prompt in the common path. A resumed deposit
 * on a different device/session, or one simply slower than the window,
 * still falls back to signing fresh, exactly as before, never a
 * security regression, only a UX improvement on the common path.
 */
export async function getOrCreateCorrelationWriteProof(
  address: string,
  signMessage: (message: string) => Promise<string>
): Promise<{ message: string; signature: string }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    cached &&
    cached.address === address &&
    nowSeconds - cached.issuedAtSeconds < PROOF_VALIDITY_SECONDS - REUSE_MARGIN_SECONDS
  ) {
    return { message: cached.message, signature: cached.signature };
  }

  const message = buildCorrelationWriteChallenge();
  const signature = await signMessage(message);
  cached = { address, message, signature, issuedAtSeconds: nowSeconds };
  return { message, signature };
}
