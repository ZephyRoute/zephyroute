import { randomUUID } from 'node:crypto';
import { getRedisClient } from '@/lib/redis';

export class RegistrationTokenError extends Error {}

const TOKEN_TTL_SECONDS = 300;

function tokenKey(token: string): string {
  return `onboarding-registration-token:${token}`;
}

/**
 * Independent security review finding (2026-09-22, PR stack review):
 * `POST /api/onboarding/fund/build` previously accepted any caller-
 * supplied `stellarAddress` and returned a real, sponsor-signed
 * transaction for it, with nothing checking that address was ever
 * actually produced by a DFNS registration. An attacker could generate
 * a keypair locally, request funding for it, sign the returned XDR
 * with their own key (no DFNS or passkey involvement needed at all,
 * the sponsor's signature is the only one this route's caller can't
 * already produce), and submit directly to Horizon, draining the
 * treasury's XLM reserve per call. This single-use, short-lived token
 * closes that gap: only issued once a real DFNS registration actually
 * completes (`register/complete`), bound to that exact address, and
 * consumed (deleted) the moment `fund/build` uses it, so it can never
 * be replayed and can never authorize funding for an address DFNS
 * never actually created.
 *
 * Unlike the correlation cache (Rule #9, a failure there never blocks
 * the user), a failure to issue or verify this token must fail closed:
 * this is the one control standing between an attacker-chosen address
 * and the treasury's signature, so it is deliberately never tolerated
 * or bypassed on error.
 */
export async function issueRegistrationToken(
  stellarAddress: string,
  walletId: string
): Promise<string> {
  const token = randomUUID();
  const redis = getRedisClient();
  await redis.set(tokenKey(token), JSON.stringify({ stellarAddress, walletId }), {
    ex: TOKEN_TTL_SECONDS,
  });
  return token;
}

/**
 * Verifies the token was genuinely issued for `stellarAddress` and has
 * not already been used, then deletes it so it cannot be replayed.
 * Throws on any mismatch, expiry, or missing token, never silently
 * proceeding as if the token were valid.
 */
export async function consumeRegistrationToken(
  token: string,
  stellarAddress: string
): Promise<void> {
  const redis = getRedisClient();
  const key = tokenKey(token);
  const record = await redis.get<{ stellarAddress: string; walletId: string }>(key);
  if (!record || record.stellarAddress !== stellarAddress) {
    throw new RegistrationTokenError(
      'This account was not just registered through onboarding, or the registration has expired. Start over.'
    );
  }
  await redis.del(key);
}
