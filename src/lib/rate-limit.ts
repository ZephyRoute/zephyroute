import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient } from '@/lib/redis';

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit {
  if (limiter) return limiter;
  limiter = new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'ratelimit',
  });
  return limiter;
}

/**
 * Issue #54: specified in `architecture.md`/`epics.md`/`threat-model.md`
 * (a dedicated DoS.1 threat entry) but never actually implemented on
 * any of the 13 API routes before this. 20 requests per rolling minute
 * per identifier, a starting point meant to stop volumetric abuse, not
 * a precisely tuned figure, easy to adjust per route later if a real
 * usage pattern needs it.
 *
 * Threat Model DoS.1/Mon.2's own accepted tradeoff: if Redis itself is
 * unavailable, the app stays available (Rule #9/AC #9) with rate
 * limiting degraded during that window, not the whole route failing
 * closed. `getRedisClient()` throws when unconfigured, and a real
 * Upstash outage surfaces the same way here, both caught and treated
 * as "allow", matching that already-documented decision rather than
 * introducing a new one.
 */
export async function checkRateLimit(identifier: string): Promise<boolean> {
  try {
    const { success } = await getLimiter().limit(identifier);
    return success;
  } catch {
    return true;
  }
}

/**
 * Best-effort client IP for the routes with no caller address yet to
 * key by (a fresh quote request, registration challenge/complete before
 * any wallet exists, traction metrics). `x-forwarded-for` is the
 * standard Vercel sets this behind; `'unknown'` as a shared fallback
 * bucket is an accepted, explicit limitation, not a silent gap, since
 * every caller with no header at all shares one limit rather than
 * going unrestricted.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
