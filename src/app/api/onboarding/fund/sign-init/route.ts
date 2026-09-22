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
        toErrorEnvelope('ONBOARDING_NOT_CONFIGURED', 'Account setup is not available yet.'),
        { status: 503 }
      );
    }
    if (cause instanceof DfnsRequestError) {
      return Response.json(toErrorEnvelope('SIGNING_INIT_FAILED', cause.message), { status: 502 });
    }
    return Response.json(
      toErrorEnvelope('SIGNING_INIT_FAILED', 'Could not start signing. Try again.'),
      { status: 500 }
    );
  }
}
