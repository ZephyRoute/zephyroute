import { computeTractionMetrics, TractionMetricsError } from '@/lib/traction-metrics';
import { toErrorEnvelope, logServerError } from '@/lib/error-envelope';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Story 3.2: a project-team-facing aggregate, distinct from Story
 * 1.12's per-address signed-nonce lookup, it never exposes individual
 * address-level data to an arbitrary caller. Protected by Vercel's own
 * deployment protection (a dashboard setting), not a new application-
 * level auth system, per the AC's own instruction; flagged, not done
 * autonomously, the same pattern Story 1.3 already used for GitHub
 * branch protection.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return Response.json(
      toErrorEnvelope('RATE_LIMITED', 'Too many requests. Try again shortly.'),
      { status: 429 }
    );
  }

  try {
    const metrics = await computeTractionMetrics();
    return Response.json(metrics);
  } catch (cause) {
    if (cause instanceof TractionMetricsError) {
      return Response.json(toErrorEnvelope('TRACTION_METRICS_FAILED', cause.message), {
        status: 502,
      });
    }
    logServerError('traction-metrics', 'TRACTION_METRICS_FAILED', cause);
    return Response.json(
      toErrorEnvelope('TRACTION_METRICS_FAILED', 'Could not compute traction metrics.'),
      { status: 500 }
    );
  }
}
