import { completeEndUserRegistration, DfnsConfigError, DfnsRequestError } from '@/lib/dfns-client';
import { toErrorEnvelope } from '@/lib/error-envelope';
import type { RegisterEndUserBody } from '@dfns/sdk/generated/auth';

interface RegisterCompleteBody {
  firstFactorCredential: RegisterEndUserBody['firstFactorCredential'];
  walletName: string;
}

function isRegisterCompleteBody(body: unknown): body is RegisterCompleteBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    !!b.firstFactorCredential &&
    typeof b.firstFactorCredential === 'object' &&
    typeof b.walletName === 'string'
  );
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

  if (!isRegisterCompleteBody(body)) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'firstFactorCredential and walletName are required.'),
      { status: 400 }
    );
  }

  try {
    const result = await completeEndUserRegistration(body.firstFactorCredential, body.walletName);
    const wallet = result.wallets.find((w) => w.network === 'Stellar');
    if (!wallet?.address) {
      return Response.json(
        toErrorEnvelope('REGISTRATION_FAILED', 'DFNS did not return a Stellar wallet address.'),
        { status: 502 }
      );
    }
    return Response.json({
      userId: result.user.id,
      authToken: result.authentication.token,
      walletId: wallet.id,
      stellarAddress: wallet.address,
    });
  } catch (cause) {
    if (cause instanceof DfnsConfigError) {
      return Response.json(
        toErrorEnvelope('ONBOARDING_NOT_CONFIGURED', 'Account setup is not available yet.'),
        { status: 503 }
      );
    }
    if (cause instanceof DfnsRequestError) {
      return Response.json(toErrorEnvelope('REGISTRATION_FAILED', cause.message), { status: 502 });
    }
    return Response.json(
      toErrorEnvelope('REGISTRATION_FAILED', 'Could not finish account setup.'),
      { status: 500 }
    );
  }
}
