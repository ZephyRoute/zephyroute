import {
  completeWalletSignature,
  waitForWalletSignature,
  extractSignatureBytes,
  DfnsConfigError,
  DfnsRequestError,
  DfnsSigningTimeoutError,
} from '@/lib/dfns-client';
import {
  attachDepositorSignatureAndSubmit,
  DepositSubmissionError,
} from '@/lib/deposit-dfns-signing';
import { toErrorEnvelope } from '@/lib/error-envelope';
import type { SignUserActionChallengeRequest } from '@dfns/sdk';

interface SignCompleteBody {
  walletId: string;
  hashHex: string;
  signedChallenge: SignUserActionChallengeRequest;
  unsignedXdr: string;
  depositorAddress: string;
}

function isSignCompleteBody(body: unknown): body is SignCompleteBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.walletId === 'string' &&
    typeof b.hashHex === 'string' &&
    !!b.signedChallenge &&
    typeof b.signedChallenge === 'object' &&
    typeof b.unsignedXdr === 'string' &&
    typeof b.depositorAddress === 'string'
  );
}

/**
 * Issue #16, gap #2: completes DFNS signing for a DeFindex deposit
 * transaction, polls until the MPC signature is ready, then attaches
 * it and submits, the deposit-transaction counterpart to
 * `/api/onboarding/fund/sign-complete`. Unlike the onboarding
 * transaction (sponsor-cosigned, the new account's signature is
 * appended to an already partially-signed transaction), the deposit
 * transaction has the depositor as its sole source account, so
 * `unsignedXdr` here carries no signatures yet at all.
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
        'walletId, hashHex, signedChallenge, unsignedXdr, and depositorAddress are required.'
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
    const submitted = await attachDepositorSignatureAndSubmit(
      body.unsignedXdr,
      body.depositorAddress,
      signatureBytes
    );
    return Response.json(submitted);
  } catch (cause) {
    if (cause instanceof DfnsConfigError) {
      return Response.json(
        toErrorEnvelope('DFNS_NOT_CONFIGURED', 'DFNS signing is not available right now.'),
        { status: 503 }
      );
    }
    if (cause instanceof DfnsSigningTimeoutError) {
      return Response.json(toErrorEnvelope('SIGNING_TIMEOUT', cause.message), { status: 504 });
    }
    if (cause instanceof DfnsRequestError || cause instanceof DepositSubmissionError) {
      return Response.json(toErrorEnvelope('DEPOSIT_SIGNING_COMPLETE_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('DEPOSIT_SIGNING_COMPLETE_FAILED', 'Could not sign the deposit. Try again.'),
      { status: 500 }
    );
  }
}
