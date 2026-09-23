import { startEndUserRegistration, DfnsConfigError, DfnsRequestError } from '@/lib/dfns-client';
import { toErrorEnvelope } from '@/lib/error-envelope';

interface RegisterChallengeBody {
  email: string;
  externalId: string;
}

function isRegisterChallengeBody(body: unknown): body is RegisterChallengeBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.email === 'string' && typeof b.externalId === 'string';
}

/**
 * `startEndUserRegistration` carries DFNS's Service Account credential,
 * a real secret, so this route is the only place that uses it.
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

  if (!isRegisterChallengeBody(body)) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'email and externalId are required.'),
      { status: 400 }
    );
  }

  try {
    const challenge = await startEndUserRegistration(body.email, body.externalId);
    return Response.json(challenge);
  } catch (cause) {
    if (cause instanceof DfnsConfigError) {
      return Response.json(
        toErrorEnvelope('ONBOARDING_NOT_CONFIGURED', 'Account setup is not available yet.'),
        { status: 503 }
      );
    }
    if (cause instanceof DfnsRequestError) {
      return Response.json(toErrorEnvelope('REGISTRATION_CHALLENGE_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('REGISTRATION_CHALLENGE_FAILED', 'Could not start account setup.'),
      { status: 500 }
    );
  }
}
