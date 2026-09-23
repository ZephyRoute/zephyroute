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
import { inspectDepositTransaction, DepositXDRInspectionError } from '@/lib/deposit-xdr-inspector';
import { requiredVaultAddress, DepositBuildError } from '@/lib/defindex-client';
import { validateTransactionXDR, InvalidTransactionXDRError } from '@/lib/validation';
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
    // Security review finding: `hashHex` was previously handed straight
    // to DFNS with no proof it was actually this depositor's real
    // deposit transaction, a signing oracle for this wallet's key.
    // Re-derives the real hash server-side (the same computation
    // `inspectDepositTransaction` already does and this project already
    // trusts client-side) and requires it to match exactly, plus the
    // same vault/function/authorization checks the client already runs,
    // now enforced here too since a direct API call bypasses the client
    // entirely. Only a genuinely well-formed deposit to this server's
    // own configured vault, authorized by this depositor, whose hash is
    // exactly what's being asked to sign, ever reaches DFNS.
    const validatedXdr = validateTransactionXDR(body.unsignedXdr);
    const info = inspectDepositTransaction(validatedXdr, {
      vaultAddress: requiredVaultAddress(),
      depositorAddress: body.depositorAddress,
    });
    if (info.transactionHashHex !== body.hashHex.toLowerCase()) {
      return Response.json(
        toErrorEnvelope(
          'DEPOSIT_HASH_MISMATCH',
          'The signature request does not match this deposit transaction.'
        ),
        { status: 400 }
      );
    }

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
    if (cause instanceof InvalidTransactionXDRError || cause instanceof DepositXDRInspectionError) {
      return Response.json(toErrorEnvelope('DEPOSIT_HASH_MISMATCH', cause.message), {
        status: 400,
      });
    }
    if (cause instanceof DfnsConfigError || cause instanceof DepositBuildError) {
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
