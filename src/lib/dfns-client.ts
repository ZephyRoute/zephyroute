import { DfnsApiClient, DfnsDelegatedApiClient } from '@dfns/sdk';
import { AsymmetricKeySigner } from '@dfns/sdk-keysigner';
import type {
  CreateDelegatedRegistrationChallengeResponse,
  RegisterEndUserBody,
  RegisterEndUserResponse,
} from '@dfns/sdk/generated/auth';
import type {
  GenerateSignatureBody,
  GenerateSignatureResponse,
  GetSignatureResponse,
} from '@dfns/sdk/generated/wallets';
import type { SignUserActionChallengeRequest, UserActionChallengeResponse } from '@dfns/sdk';

export class DfnsConfigError extends Error {}
export class DfnsRequestError extends Error {}

/**
 * Story 2.2: requires an actual DFNS organization and service account,
 * an external signup this project cannot self-provision, the same
 * honest gap `DEFINDEX_VAULT_ADDRESS` already has. Throws explicitly
 * rather than silently proceeding with an unconfigured client.
 */
function requiredDfnsConfig() {
  const orgId = process.env.DFNS_ORG_ID;
  const authToken = process.env.DFNS_SERVICE_ACCOUNT_AUTH_TOKEN;
  const credId = process.env.DFNS_SERVICE_ACCOUNT_CRED_ID;
  const privateKey = process.env.DFNS_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!orgId || !authToken || !credId || !privateKey) {
    throw new DfnsConfigError(
      'DFNS is not configured. DFNS_ORG_ID, DFNS_SERVICE_ACCOUNT_AUTH_TOKEN, DFNS_SERVICE_ACCOUNT_CRED_ID, and DFNS_SERVICE_ACCOUNT_PRIVATE_KEY must all be set.'
    );
  }
  return {
    baseUrl: process.env.DFNS_API_URL || 'https://api.dfns.io',
    orgId,
    authToken,
    credId,
    privateKey,
  };
}

let serviceAccountClient: DfnsApiClient | null = null;
let delegatedClient: DfnsDelegatedApiClient | null = null;

/**
 * The Service Account's own authenticated client: used for the two
 * calls that bootstrap a brand-new end user (there is no existing
 * end-user credential yet to delegate to), both single-call, non
 * Init/Complete endpoints per DFNS's own docs and `.d.ts`.
 */
function getServiceAccountClient(): DfnsApiClient {
  if (serviceAccountClient) return serviceAccountClient;
  const config = requiredDfnsConfig();
  serviceAccountClient = new DfnsApiClient({
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    orgId: config.orgId,
    signer: new AsymmetricKeySigner({ credId: config.credId, privateKey: config.privateKey }),
  });
  return serviceAccountClient;
}

/**
 * The delegated client: still authenticated as the Service Account,
 * but every call here acts on a specific end user's own wallet, with
 * the actual authorization coming from that user's own passkey via
 * the Init (server) -> browser signs -> Complete (server) pattern.
 */
function getDelegatedClient(): DfnsDelegatedApiClient {
  if (delegatedClient) return delegatedClient;
  const config = requiredDfnsConfig();
  delegatedClient = new DfnsDelegatedApiClient({
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    orgId: config.orgId,
  });
  return delegatedClient;
}

/**
 * Story 2.2, AC #3: the first half of registering a brand-new,
 * non-custodial end user. Returns a WebAuthn registration challenge
 * for the browser's passkey ceremony, DFNS never sees or requests a
 * private key at any point in this flow.
 */
export async function startEndUserRegistration(
  email: string,
  externalId: string
): Promise<CreateDelegatedRegistrationChallengeResponse> {
  try {
    return await getServiceAccountClient().auth.createDelegatedRegistrationChallenge({
      body: { email, kind: 'EndUser', externalId },
    });
  } catch (cause) {
    throw new DfnsRequestError('Could not start account setup. Try again.', { cause });
  }
}

/**
 * Completes registration with the browser's signed passkey attestation
 * and creates the new user's Stellar wallet in the same call (AC #1).
 */
export async function completeEndUserRegistration(
  firstFactorCredential: RegisterEndUserBody['firstFactorCredential'],
  walletName: string
): Promise<RegisterEndUserResponse> {
  try {
    return await getServiceAccountClient().auth.registerEndUser({
      body: {
        firstFactorCredential,
        wallets: [{ network: 'Stellar', name: walletName }],
      },
    });
  } catch (cause) {
    throw new DfnsRequestError('Could not finish account setup. Try again.', { cause });
  }
}

export async function initWalletSignature(
  walletId: string,
  hashHex: string
): Promise<UserActionChallengeResponse> {
  const body: GenerateSignatureBody = { kind: 'Hash', hash: hashHex, network: 'Stellar' };
  try {
    return await getDelegatedClient().wallets.generateSignatureInit({ walletId, body });
  } catch (cause) {
    throw new DfnsRequestError('Could not start signing. Try again.', { cause });
  }
}

export async function completeWalletSignature(
  walletId: string,
  hashHex: string,
  signedChallenge: SignUserActionChallengeRequest
): Promise<GenerateSignatureResponse> {
  const body: GenerateSignatureBody = { kind: 'Hash', hash: hashHex, network: 'Stellar' };
  try {
    return await getDelegatedClient().wallets.generateSignatureComplete(
      { walletId, body },
      signedChallenge
    );
  } catch (cause) {
    throw new DfnsRequestError('Could not complete signing. Try again.', { cause });
  }
}

export async function getWalletSignature(
  walletId: string,
  signatureId: string
): Promise<GetSignatureResponse> {
  try {
    return await getDelegatedClient().wallets.getSignature({ walletId, signatureId });
  } catch (cause) {
    throw new DfnsRequestError('Could not check signing status. Try again.', { cause });
  }
}

export class DfnsSigningTimeoutError extends Error {}

const SIGNATURE_POLL_INTERVAL_MS = 1000;
const MAX_SIGNATURE_POLL_ATTEMPTS = 20;

/**
 * Polls `getSignature` until the async MPC signature is ready. Shared
 * between the onboarding transaction's signing route (Story 2.2) and
 * the deposit transaction's signing route (Issue #16), both need the
 * identical wait loop, generateSignature is asynchronous regardless of
 * which transaction it's signing.
 */
export async function waitForWalletSignature(
  walletId: string,
  signatureId: string
): Promise<GetSignatureResponse> {
  for (let attempt = 0; attempt < MAX_SIGNATURE_POLL_ATTEMPTS; attempt++) {
    const result = await getWalletSignature(walletId, signatureId);
    if (result.status === 'Signed' || result.status === 'Confirmed') return result;
    if (result.status === 'Failed' || result.status === 'Rejected') {
      throw new DfnsRequestError(
        `DFNS signing ${result.status.toLowerCase()}: ${result.reason ?? 'no reason given'}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, SIGNATURE_POLL_INTERVAL_MS));
  }
  throw new DfnsSigningTimeoutError('Signing took too long. Try again.');
}

/** Extracts raw signature bytes from a completed DFNS signature result. */
export function extractSignatureBytes(result: GetSignatureResponse): Uint8Array {
  const signature = result.signature;
  if (signature?.encoded) {
    return new Uint8Array(Buffer.from(signature.encoded, 'hex'));
  }
  if (signature?.r && signature?.s) {
    return new Uint8Array(Buffer.from(signature.r + signature.s, 'hex'));
  }
  throw new DfnsRequestError('DFNS did not return a usable signature.');
}
