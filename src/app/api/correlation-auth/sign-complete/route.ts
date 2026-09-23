import {
  completeWalletSignature,
  waitForWalletSignature,
  extractSignatureBytes,
  DfnsConfigError,
  DfnsRequestError,
  DfnsSigningTimeoutError,
} from '@/lib/dfns-client';
import { toErrorEnvelope } from '@/lib/error-envelope';
import type { SignUserActionChallengeRequest } from '@dfns/sdk';

interface SignCompleteBody {
  walletId: string;
  hashHex: string;
  signedChallenge: SignUserActionChallengeRequest;
}

function isSignCompleteBody(body: unknown): body is SignCompleteBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.walletId === 'string' &&
    typeof b.hashHex === 'string' &&
    !!b.signedChallenge &&
    typeof b.signedChallenge === 'object'
  );
}

/**
 * Security review follow-on: completes DFNS signing for a SEP-53
 * challenge hash and returns the raw signature, base64-encoded, ready
 * for `Keypair.verifyMessage` to check server-side exactly as if a
 * StellarWalletsKit wallet had produced it. Never attaches to or
 * submits any transaction, this signs a message, not a transfer.
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
      toErrorEnvelope('INVALID_REQUEST_BODY', 'walletId, hashHex, and signedChallenge are required.'),
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
    return Response.json({ signature: Buffer.from(signatureBytes).toString('base64') });
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
    if (cause instanceof DfnsRequestError) {
      return Response.json(toErrorEnvelope('MESSAGE_SIGNING_COMPLETE_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('MESSAGE_SIGNING_COMPLETE_FAILED', 'Could not sign the challenge. Try again.'),
      { status: 500 }
    );
  }
}
