import { Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  completeWalletSignature,
  waitForWalletSignature,
  extractSignatureBytes,
  DfnsConfigError,
  DfnsRequestError,
  DfnsSigningTimeoutError,
} from '@/lib/dfns-client';
import {
  attachSignatureAndSubmit,
  OnboardingTransactionError,
} from '@/lib/onboarding-transaction';
import { toErrorEnvelope } from '@/lib/error-envelope';
import type { SignUserActionChallengeRequest } from '@dfns/sdk';

export class OnboardingSignCompleteMismatchError extends Error {}

/**
 * Security review finding: `hashHex` was previously handed straight to
 * DFNS with no proof it was actually this new account's real onboarding
 * transaction, a signing oracle for this wallet's key. Re-derives the
 * real hash server-side and requires it to match exactly, and confirms
 * `stellarAddress` is genuinely the account `partiallySignedXdr` creates
 * (the `createAccount` operation's own `destination`), not just trusted
 * from the request body. Only a transaction that's actually what it
 * claims to be, whose hash is exactly what's being asked to sign, ever
 * reaches DFNS.
 */
function verifyOnboardingSignRequest(
  partiallySignedXdr: string,
  stellarAddress: string,
  hashHex: string
): void {
  let transaction;
  try {
    transaction = TransactionBuilder.fromXDR(partiallySignedXdr, Networks.PUBLIC);
  } catch (cause) {
    throw new OnboardingSignCompleteMismatchError('Could not parse the onboarding transaction.', {
      cause,
    });
  }
  if (!('operations' in transaction)) {
    throw new OnboardingSignCompleteMismatchError('Unexpected fee-bump onboarding transaction.');
  }

  const createAccountOp = transaction.operations.find((op) => op.type === 'createAccount');
  if (!createAccountOp || createAccountOp.destination !== stellarAddress) {
    throw new OnboardingSignCompleteMismatchError(
      'The stellarAddress does not match the account this transaction creates.'
    );
  }

  const realHashHex = Buffer.from(transaction.hash()).toString('hex');
  if (realHashHex !== hashHex.toLowerCase()) {
    throw new OnboardingSignCompleteMismatchError(
      'The signature request does not match this onboarding transaction.'
    );
  }
}

interface SignCompleteBody {
  walletId: string;
  hashHex: string;
  signedChallenge: SignUserActionChallengeRequest;
  partiallySignedXdr: string;
  stellarAddress: string;
}

function isSignCompleteBody(body: unknown): body is SignCompleteBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.walletId === 'string' &&
    typeof b.hashHex === 'string' &&
    !!b.signedChallenge &&
    typeof b.signedChallenge === 'object' &&
    typeof b.partiallySignedXdr === 'string' &&
    typeof b.stellarAddress === 'string'
  );
}

/**
 * Completes the DFNS signing flow for the new account's portion of
 * the sponsored onboarding transaction, polls until the MPC signature
 * is ready (`generateSignature` is asynchronous), then attaches it and
 * submits, the last step of Story 2.2's onboarding flow.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'Request body must be valid JSON.'),
      { status: 400 }
    );
  }

  if (!isSignCompleteBody(body)) {
    return Response.json(
      toErrorEnvelope(
        'INVALID_REQUEST_BODY',
        'walletId, hashHex, signedChallenge, partiallySignedXdr, and stellarAddress are required.'
      ),
      { status: 400 }
    );
  }

  try {
    verifyOnboardingSignRequest(body.partiallySignedXdr, body.stellarAddress, body.hashHex);

    const initiated = await completeWalletSignature(
      body.walletId,
      body.hashHex,
      body.signedChallenge
    );
    const signed = await waitForWalletSignature(body.walletId, initiated.id);
    const signatureBytes = extractSignatureBytes(signed);
    const submitted = await attachSignatureAndSubmit(
      body.partiallySignedXdr,
      body.stellarAddress,
      signatureBytes
    );
    if (!submitted.successful) {
      return Response.json(
        toErrorEnvelope(
          'ONBOARDING_SUBMISSION_REJECTED',
          'The onboarding transaction was rejected by the network.'
        ),
        { status: 502 }
      );
    }
    return Response.json(submitted);
  } catch (cause) {
    if (cause instanceof OnboardingSignCompleteMismatchError) {
      return Response.json(toErrorEnvelope('ONBOARDING_HASH_MISMATCH', cause.message), {
        status: 400,
      });
    }
    if (cause instanceof DfnsConfigError) {
      return Response.json(
        toErrorEnvelope('ONBOARDING_NOT_CONFIGURED', 'Account setup is not available yet.'),
        { status: 503 }
      );
    }
    if (cause instanceof DfnsSigningTimeoutError) {
      return Response.json(toErrorEnvelope('SIGNING_TIMEOUT', cause.message), { status: 504 });
    }
    if (cause instanceof DfnsRequestError || cause instanceof OnboardingTransactionError) {
      return Response.json(toErrorEnvelope('SIGNING_COMPLETE_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('SIGNING_COMPLETE_FAILED', 'Could not complete account setup. Try again.'),
      { status: 500 }
    );
  }
}
