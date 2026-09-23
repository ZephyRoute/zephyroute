import { writeCorrelationRecord, InvalidCorrelationRecordError } from '@/lib/validation';
import { toErrorEnvelope } from '@/lib/error-envelope';

/**
 * `writeCorrelationRecord` carries the Upstash Redis REST token, a
 * real write-capable database credential. This route is the only
 * place that secret is used, so it never needs to reach the browser
 * (see Issue #7).
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

  if (!body || typeof body !== 'object') {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'Request body must be an object.'),
      { status: 400 }
    );
  }

  try {
    await writeCorrelationRecord(body as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch (cause) {
    if (cause instanceof InvalidCorrelationRecordError) {
      return Response.json(toErrorEnvelope('INVALID_CORRELATION_RECORD', cause.message), {
        status: 400,
      });
    }
    // Rule #9: a failed cache write is never treated as a failed
    // settlement by the caller, but it must still be reported here,
    // never swallowed silently at this layer.
    return Response.json(
      toErrorEnvelope('CORRELATION_WRITE_FAILED', 'Could not record this deposit. Try again.'),
      { status: 502 }
    );
  }
}
