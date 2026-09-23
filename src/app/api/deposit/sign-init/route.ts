import { initWalletSignature, DfnsConfigError, DfnsRequestError } from '@/lib/dfns-client';
import { toErrorEnvelope } from '@/lib/error-envelope';

interface SignInitBody {
  walletId: string;
  hashHex: string;
}

function isSignInitBody(body: unknown): body is SignInitBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.walletId === 'string' && typeof b.hashHex === 'string';
}

/**
 * Issue #16, gap #2: the deposit-transaction counterpart to
 * `/api/onboarding/fund/sign-init`, a thin, generic wrapper around
 * `initWalletSignature` (itself already generic, takes any
 * `walletId`/`hashHex` pair, not onboarding-specific). Kept as its own
 * route under `/api/deposit/`, matching this project's existing
 * per-concern route namespacing, rather than reused from the
 * onboarding namespace, so a deposit-signing failure never gets
 * misreported through an `ONBOARDING_*` error code.
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

  if (!isSignInitBody(body)) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'walletId and hashHex are required.'),
      { status: 400 }
    );
  }

  try {
    const challenge = await initWalletSignature(body.walletId, body.hashHex);
    return Response.json(challenge);
  } catch (cause) {
    if (cause instanceof DfnsConfigError) {
      return Response.json(
        toErrorEnvelope('DFNS_NOT_CONFIGURED', 'DFNS signing is not available right now.'),
        { status: 503 }
      );
    }
    if (cause instanceof DfnsRequestError) {
      return Response.json(toErrorEnvelope('DEPOSIT_SIGNING_INIT_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('DEPOSIT_SIGNING_INIT_FAILED', 'Could not start signing. Try again.'),
      { status: 500 }
    );
  }
}
