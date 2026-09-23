import {
  writeCorrelationRecord,
  updateCorrelationRecordWithDeposit,
  InvalidCorrelationRecordError,
  CorrelationRecordNotFoundError,
} from '@/lib/validation';
import { verifyCorrelationWriteProof, InvalidProofError } from '@/lib/auth-nonce';
import { toErrorEnvelope } from '@/lib/error-envelope';

/**
 * `writeCorrelationRecord` carries the Upstash Redis REST token, a
 * real write-capable database credential. This route is the only
 * place that secret is used, so it never needs to reach the browser
 * (see Issue #7).
 *
 * Security review finding: previously accepted a write for any
 * `stellarAddress` from any caller, no proof they controlled it,
 * letting anyone forge another address's record (feeding both the
 * resume flow's auto-started deposit amount and the traction metrics).
 * `message`/`signature` (a signed `zephyroute:correlation-write:`
 * challenge, `lib/auth-nonce.ts`) now proves the caller controls
 * `stellarAddress` before anything is written. This proves address
 * control, not that the settlement itself happened, independently
 * reconstructing that from Horizon/1Click is a larger, separate piece
 * of work (see the security review's own notes on this).
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

  const rawBody = body as Record<string, unknown>;
  const proofError = verifyWriteProof(rawBody);
  if (proofError) return proofError;

  // `message`/`signature` are the write proof, not part of the
  // correlation record itself, stripped before persisting so they
  // never pollute the stored record's shape.
  const { message: _message, signature: _signature, ...record } = rawBody;

  try {
    await writeCorrelationRecord(record);
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

/**
 * Shared by POST and PATCH: verifies `message`/`signature` prove
 * control of `stellarAddress` before either ever touches Redis.
 * Returns a ready-to-send error `Response` on failure, `null` when the
 * proof checks out, so each handler can `return` it directly without
 * duplicating the error-shape logic.
 */
function verifyWriteProof(body: {
  stellarAddress?: unknown;
  message?: unknown;
  signature?: unknown;
}): Response | null {
  const { stellarAddress, message, signature } = body;
  if (
    typeof stellarAddress !== 'string' ||
    typeof message !== 'string' ||
    typeof signature !== 'string'
  ) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'stellarAddress, message, and signature are required.'),
      { status: 400 }
    );
  }
  try {
    verifyCorrelationWriteProof(stellarAddress, message, signature);
    return null;
  } catch (cause) {
    if (cause instanceof InvalidProofError) {
      return Response.json(toErrorEnvelope('INVALID_WRITE_PROOF', cause.message), { status: 401 });
    }
    return Response.json(
      toErrorEnvelope('INVALID_WRITE_PROOF', 'Could not verify you control this address.'),
      { status: 401 }
    );
  }
}

interface DepositUpdateBody {
  stellarAddress: string;
  destinationVault: string;
  depositStatus: 'completed' | 'reverted';
  depositConfirmedAt: string;
  message: string;
  signature: string;
}

function isDepositUpdateBody(body: unknown): body is DepositUpdateBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.stellarAddress === 'string' &&
    typeof b.destinationVault === 'string' &&
    (b.depositStatus === 'completed' || b.depositStatus === 'reverted') &&
    typeof b.depositConfirmedAt === 'string' &&
    typeof b.message === 'string' &&
    typeof b.signature === 'string'
  );
}

/**
 * Story 1.11, AC #4: merges the deposit's on-chain outcome into the
 * record Story 1.8 already wrote for this address. Same write-proof
 * requirement as `POST`, see its own comment for the finding.
 */
export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'Request body must be valid JSON.'),
      { status: 400 }
    );
  }

  if (!isDepositUpdateBody(body)) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'Missing or malformed deposit update fields.'),
      { status: 400 }
    );
  }

  const proofError = verifyWriteProof(body);
  if (proofError) return proofError;

  try {
    await updateCorrelationRecordWithDeposit(body.stellarAddress, {
      destinationVault: body.destinationVault,
      depositStatus: body.depositStatus,
      depositConfirmedAt: body.depositConfirmedAt,
    });
    return Response.json({ ok: true });
  } catch (cause) {
    if (cause instanceof CorrelationRecordNotFoundError) {
      return Response.json(toErrorEnvelope('CORRELATION_RECORD_NOT_FOUND', cause.message), {
        status: 404,
      });
    }
    if (cause instanceof InvalidCorrelationRecordError) {
      return Response.json(toErrorEnvelope('INVALID_CORRELATION_RECORD', cause.message), {
        status: 400,
      });
    }
    return Response.json(
      toErrorEnvelope('CORRELATION_WRITE_FAILED', 'Could not record this deposit. Try again.'),
      { status: 502 }
    );
  }
}
