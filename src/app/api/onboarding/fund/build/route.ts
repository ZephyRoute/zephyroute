import {
  buildOnboardingTransaction,
  SponsorConfigError,
  OnboardingTransactionError,
} from '@/lib/onboarding-transaction';
import {
  consumeRegistrationToken,
  RegistrationTokenError,
} from '@/lib/onboarding-registration-token';
import { toErrorEnvelope } from '@/lib/error-envelope';

interface FundBuildBody {
  stellarAddress: string;
  assetCode: string;
  assetIssuer?: string;
  registrationToken: string;
}

function isFundBuildBody(body: unknown): body is FundBuildBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.stellarAddress === 'string' &&
    typeof b.assetCode === 'string' &&
    (b.assetIssuer === undefined || typeof b.assetIssuer === 'string') &&
    typeof b.registrationToken === 'string'
  );
}

/**
 * `buildOnboardingTransaction` carries Zephyroute's own treasury
 * secret key, a real spend-capable credential, so this route is the
 * only place that uses it.
 *
 * Security review finding (2026-09-22): `stellarAddress` alone is
 * attacker-controllable input, never trusted on its own before this
 * fix, see `lib/onboarding-registration-token.ts` for the full
 * finding. `registrationToken` (single-use, issued only by a real
 * `register/complete` call, consumed here) is what proves this address
 * genuinely came from a DFNS registration that just completed, before
 * the treasury's signature is ever attached to anything.
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

  if (!isFundBuildBody(body)) {
    return Response.json(
      toErrorEnvelope(
        'INVALID_REQUEST_BODY',
        'stellarAddress, assetCode, and registrationToken are required.'
      ),
      { status: 400 }
    );
  }

  try {
    await consumeRegistrationToken(body.registrationToken, body.stellarAddress);
  } catch (cause) {
    if (cause instanceof RegistrationTokenError) {
      return Response.json(toErrorEnvelope('REGISTRATION_TOKEN_INVALID', cause.message), {
        status: 403,
      });
    }
    return Response.json(
      toErrorEnvelope('ONBOARDING_BUILD_FAILED', 'Could not verify your registration. Try again.'),
      { status: 500 }
    );
  }

  try {
    const result = await buildOnboardingTransaction(body.stellarAddress, {
      code: body.assetCode,
      issuer: body.assetIssuer,
    });
    return Response.json(result);
  } catch (cause) {
    if (cause instanceof SponsorConfigError) {
      return Response.json(
        toErrorEnvelope('ONBOARDING_NOT_CONFIGURED', 'Account setup is not available yet.'),
        { status: 503 }
      );
    }
    if (cause instanceof OnboardingTransactionError) {
      return Response.json(toErrorEnvelope('ONBOARDING_BUILD_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('ONBOARDING_BUILD_FAILED', 'Could not prepare your account. Try again.'),
      { status: 500 }
    );
  }
}
