import { verifyCorrelationReadProof, InvalidProofError } from '@/lib/auth-nonce';
import { getDepositorVaultBalance, requiredVaultAddress, DepositBuildError } from '@/lib/defindex-client';
import { getRedisClient } from '@/lib/redis';
import type { CorrelationRecord } from '@/lib/validation';
import { toErrorEnvelope } from '@/lib/error-envelope';

type CorrelationStatusResponse =
  | { status: 'earning'; vaultAddress: string; dfTokens: number }
  | { status: 'resumable-deposit'; settledAmount: string; originChainAsset: string }
  | { status: 'none' };

/**
 * Story 1.12, AC #1: the signed-nonce proof gates every response here,
 * an open address-only lookup would otherwise let anyone enumerate
 * who has settled or is earning, a real privacy gap this closes.
 */
export async function GET(
  request: Request,
  context: RouteContext<'/api/correlation/[address]'>
): Promise<Response> {
  const { address } = await context.params;
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message');
  const signature = searchParams.get('signature');

  if (!message || !signature) {
    return Response.json(
      toErrorEnvelope('INVALID_REQUEST_BODY', 'message and signature query parameters are required.'),
      { status: 400 }
    );
  }

  try {
    verifyCorrelationReadProof(address, message, signature);
  } catch (cause) {
    if (cause instanceof InvalidProofError) {
      return Response.json(toErrorEnvelope('INVALID_PROOF', cause.message), { status: 401 });
    }
    return Response.json(
      toErrorEnvelope('INVALID_PROOF', 'Could not verify the signed challenge.'),
      { status: 401 }
    );
  }

  // AC #9/FR9: Redis is a convenience lookup, never a source of truth.
  // A missing or unreachable record falls back to a direct on-chain
  // query rather than surfacing an error, matching Rule #9.
  let record: CorrelationRecord | null = null;
  try {
    record = await getRedisClient().get<CorrelationRecord>(`correlation:${address}`);
  } catch {
    record = null;
  }

  if (record?.depositStatus === 'completed' && record.destinationVault) {
    const balance = await getDepositorVaultBalance(record.destinationVault, address).catch(
      () => null
    );
    return Response.json({
      status: 'earning',
      vaultAddress: record.destinationVault,
      dfTokens: balance?.dfTokens ?? 0,
    } satisfies CorrelationStatusResponse);
  }

  if (record && !record.depositStatus) {
    return Response.json({
      status: 'resumable-deposit',
      settledAmount: record.settledAmount,
      originChainAsset: record.originChainAsset,
    } satisfies CorrelationStatusResponse);
  }

  // No usable record (Redis unavailable, or it predates this address
  // ever settling): fall back to a direct DeFindex balance check
  // against the default vault. A genuine scope limit, documented in
  // Issue #11: reconstructing a settled-but-undeposited balance from
  // Horizon alone, with no correlation record, would need the origin
  // 1Click quote's expected destination amount, not reliably
  // recoverable from Horizon by itself, so this reports "none" rather
  // than fabricating a resume state it can't actually justify.
  try {
    const balance = await getDepositorVaultBalance(requiredVaultAddress(), address);
    if (balance.dfTokens > 0) {
      return Response.json({
        status: 'earning',
        vaultAddress: requiredVaultAddress(),
        dfTokens: balance.dfTokens,
      } satisfies CorrelationStatusResponse);
    }
  } catch (cause) {
    if (!(cause instanceof DepositBuildError)) {
      return Response.json(
        toErrorEnvelope('CORRELATION_STATUS_QUERY_FAILED', 'Could not check your account. Try again.'),
        { status: 502 }
      );
    }
    // DEFINDEX_VAULT_ADDRESS unconfigured: nothing to check against,
    // fall through to "none" rather than erroring the whole lookup.
  }

  return Response.json({ status: 'none' } satisfies CorrelationStatusResponse);
}
