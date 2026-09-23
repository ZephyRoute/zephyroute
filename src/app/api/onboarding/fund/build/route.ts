import {
  buildOnboardingTransaction,
  SponsorConfigError,
  OnboardingTransactionError,
} from '@/lib/onboarding-transaction';
import { toErrorEnvelope } from '@/lib/error-envelope';

interface FundBuildBody {
  stellarAddress: string;
  assetCode: string;
  assetIssuer?: string;
}

function isFundBuildBody(body: unknown): body is FundBuildBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.stellarAddress === 'string' &&
    typeof b.assetCode === 'string' &&
    (b.assetIssuer === undefined || typeof b.assetIssuer === 'string')
  );
}

/**
 * `buildOnboardingTransaction` carries Zephyroute's own treasury
 * secret key, a real spend-capable credential, so this route is the
 * only place that uses it.
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
      toErrorEnvelope('INVALID_REQUEST_BODY', 'stellarAddress and assetCode are required.'),
      { status: 400 }
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
