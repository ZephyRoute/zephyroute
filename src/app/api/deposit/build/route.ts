import { buildDepositTransaction, DepositBuildError } from '@/lib/defindex-client';
import { InvalidTransactionXDRError } from '@/lib/validation';
import { toErrorEnvelope } from '@/lib/error-envelope';

interface BuildDepositRequestBody {
  depositorAddress: string;
  amountInSmallestUnits: string;
  slippageBps?: number;
}

function isBuildDepositRequestBody(body: unknown): body is BuildDepositRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.depositorAddress === 'string' &&
    typeof b.amountInSmallestUnits === 'string' &&
    (b.slippageBps === undefined || typeof b.slippageBps === 'number')
  );
}

/**
 * `buildDepositTransaction` carries the DeFindex API key, documented by
 * DeFindex itself as server-side only. This route is the only place
 * that secret is used, so it never needs to reach the browser (see
 * Issue #3).
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

  if (!isBuildDepositRequestBody(body)) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'Missing or malformed deposit request fields.'),
      { status: 400 }
    );
  }

  try {
    const { xdr, vaultAddress } = await buildDepositTransaction(
      body.depositorAddress,
      body.amountInSmallestUnits,
      body.slippageBps
    );
    return Response.json({ xdr, vaultAddress });
  } catch (cause) {
    if (cause instanceof InvalidTransactionXDRError) {
      return Response.json(
        toErrorEnvelope(
          'INVALID_DEPOSIT_XDR',
          'DeFindex returned a deposit transaction that failed validation.'
        ),
        { status: 502 }
      );
    }
    if (cause instanceof DepositBuildError) {
      return Response.json(toErrorEnvelope('DEPOSIT_BUILD_FAILED', cause.message), {
        status: 502,
      });
    }
    return Response.json(
      toErrorEnvelope('DEPOSIT_BUILD_FAILED', 'Could not prepare the deposit. Try again.'),
      { status: 500 }
    );
  }
}
