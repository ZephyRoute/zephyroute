import type { WebAuthnSigner } from '@dfns/sdk-browser';
import type { UserActionChallenge } from '@dfns/sdk';
import type {
  CreateCredentialChallengeResponse,
  CreateRegistrationChallengeResponse,
} from '@dfns/sdk/generated/auth';

export class PasskeyError extends Error {}

let signer: WebAuthnSigner | null = null;

/**
 * Issue #25: `@dfns/sdk-browser` is a real, meaningful chunk of the
 * flow's bundle (only needed by a session that actually reaches DFNS
 * onboarding or DFNS-backed deposit signing, not every session), so
 * it's loaded here via a dynamic `import()` the first time a passkey
 * operation is actually needed, never at module load time, instead of
 * a static top-level import that would put it in every session's
 * initial bundle regardless of whether DFNS is ever used.
 *
 * Story 2.2, AC #3: the new user's own passkey/WebAuthn credential
 * controls their wallet's key material, never Zephyroute. The relying
 * party id/name are the app's own domain and display name, not
 * secrets, safe as `NEXT_PUBLIC_` values.
 */
async function requiredWebAuthnSigner(): Promise<WebAuthnSigner> {
  if (signer) return signer;
  const id = process.env.NEXT_PUBLIC_DFNS_RELYING_PARTY_ID;
  const name = process.env.NEXT_PUBLIC_DFNS_RELYING_PARTY_NAME;
  if (!id || !name) {
    throw new PasskeyError('Account setup is not configured yet.');
  }
  const { WebAuthnSigner } = await import('@dfns/sdk-browser');
  signer = new WebAuthnSigner({ relyingParty: { id, name } });
  return signer;
}

/**
 * Creates the new passkey credential in the browser, from the
 * registration challenge the server issued.
 */
export async function createPasskeyCredential(
  challenge: CreateRegistrationChallengeResponse | (CreateCredentialChallengeResponse & { kind: 'Fido2' })
) {
  try {
    const webAuthnSigner = await requiredWebAuthnSigner();
    return await webAuthnSigner.create(challenge);
  } catch (cause) {
    throw new PasskeyError('Could not create your passkey. Try again.', { cause });
  }
}

/** Signs a DFNS user-action challenge (e.g. authorizing a signature request) with the existing passkey. */
export async function signWithPasskey(challenge: UserActionChallenge) {
  try {
    const webAuthnSigner = await requiredWebAuthnSigner();
    return await webAuthnSigner.sign(challenge);
  } catch (cause) {
    throw new PasskeyError('Could not verify your passkey. Try again.', { cause });
  }
}
