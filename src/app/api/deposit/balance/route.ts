import { getDepositorVaultBalance, VaultBalanceQueryError } from '@/lib/defindex-client';
import { toErrorEnvelope, logServerError } from '@/lib/error-envelope';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * `getDepositorVaultBalance` carries the DeFindex API key, same as
 * `/api/deposit/build` (Issue #3). This route is the only place that
 * secret is used for balance reads.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const vaultAddress = searchParams.get('vaultAddress');
  const depositorAddress = searchParams.get('depositorAddress');

  if (!vaultAddress || !depositorAddress) {
    return Response.json(
      toErrorEnvelope(
        'INVALID_REQUEST_BODY',
        'vaultAddress and depositorAddress query parameters are required.'
      ),
      { status: 400 }
    );
  }

  if (!(await checkRateLimit(depositorAddress))) {
    return Response.json(
      toErrorEnvelope('RATE_LIMITED', 'Too many requests. Try again shortly.'),
      { status: 429 }
    );
  }

  try {
    const balance = await getDepositorVaultBalance(vaultAddress, depositorAddress);
    return Response.json(balance);
  } catch (cause) {
    if (cause instanceof VaultBalanceQueryError) {
      return Response.json(toErrorEnvelope('VAULT_BALANCE_QUERY_FAILED', cause.message), {
        status: 502,
      });
    }
    logServerError('deposit.balance', 'VAULT_BALANCE_QUERY_FAILED', cause);
    return Response.json(
      toErrorEnvelope('VAULT_BALANCE_QUERY_FAILED', 'Could not read your vault balance.'),
      { status: 500 }
    );
  }
}
