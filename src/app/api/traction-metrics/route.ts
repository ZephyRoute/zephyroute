import { computeTractionMetrics, TractionMetricsError } from '@/lib/traction-metrics';
import { toErrorEnvelope } from '@/lib/error-envelope';

/**
 * Story 3.2: a project-team-facing aggregate, distinct from Story
 * 1.12's per-address signed-nonce lookup, it never exposes individual
 * address-level data to an arbitrary caller. Protected by Vercel's own
 * deployment protection (a dashboard setting), not a new application-
 * level auth system, per the AC's own instruction; flagged, not done
 * autonomously, the same pattern Story 1.3 already used for GitHub
 * branch protection.
 */
export async function GET(): Promise<Response> {
  try {
    const metrics = await computeTractionMetrics();
    return Response.json(metrics);
  } catch (cause) {
    if (cause instanceof TractionMetricsError) {
      return Response.json(toErrorEnvelope('TRACTION_METRICS_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('TRACTION_METRICS_FAILED', 'Could not compute traction metrics.'),
      { status: 500 }
    );
  }
}
