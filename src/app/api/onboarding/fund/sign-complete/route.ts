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
import { toErrorEnvelope, logServerError } from '@/lib/error-envelope';
import type { SignUserActionChallengeRequest } from '@dfns/sdk';

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
      logServerError('onboarding.fund.sign-complete', 'SIGNING_COMPLETE_FAILED', cause);
      return Response.json(toErrorEnvelope('SIGNING_COMPLETE_FAILED', cause.message), {
        status: 502,
      });
    }
    logServerError('onboarding.fund.sign-complete', 'SIGNING_COMPLETE_FAILED', cause);
    return Response.json(
      toErrorEnvelope('SIGNING_COMPLETE_FAILED', 'Could not complete account setup. Try again.'),
      { status: 500 }
    );
  }
}
