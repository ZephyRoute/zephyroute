import {
  requestQuote,
  QuoteRejectedError,
  MissingIntegratorIdError,
  type RequestQuoteParams,
} from '@/lib/one-click-client';
import { toErrorEnvelope } from '@/lib/error-envelope';

function isRequestQuoteParams(body: unknown): body is RequestQuoteParams {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.originAsset === 'string' &&
    typeof b.destinationAsset === 'string' &&
    typeof b.amount === 'string' &&
    typeof b.recipient === 'string' &&
    typeof b.refundTo === 'string' &&
    typeof b.slippageToleranceBps === 'number' &&
    typeof b.deadline === 'string'
  );
}

/**
 * `requestQuote` carries the 1Click JWT (`ONECLICK_API_KEY`), a real
 * per-partner secret per the SDK's own docs, never a public tag. This
 * route is the only place that secret is used, so it never needs to
 * reach the browser (see Issue #3).
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

  if (!isRequestQuoteParams(body)) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'Missing or malformed quote request fields.'),
      { status: 400 }
    );
  }

  try {
    const quote = await requestQuote(body);
    return Response.json(quote);
  } catch (cause) {
    if (cause instanceof QuoteRejectedError) {
      return Response.json(toErrorEnvelope('QUOTE_REJECTED', cause.message), { status: 422 });
    }
    if (cause instanceof MissingIntegratorIdError) {
      return Response.json(
        toErrorEnvelope('MISSING_INTEGRATOR_ID', 'The quote service is not configured.'),
        { status: 500 }
      );
    }
    return Response.json(
      toErrorEnvelope('QUOTE_REQUEST_FAILED', 'Could not reach the quote service. Try again.'),
      { status: 502 }
    );
  }
}
