import { getRedisClient } from '@/lib/redis';
import type { ValidatedTransactionXDR } from '@/lib/types';

/**
 * AC #3/FR10 groundwork: the settlement facts as they first become
 * known (Story 1.8), before any deposit exists. No personally
 * identifying data (NFR7), a Stellar address and public correlation
 * IDs are not PII.
 */
export interface CorrelationRecord {
  stellarAddress: string;
  originChainAsset: string;
  settledAmount: string;
  settledAt: string;
  integratorId: string;
  correlationId: string;
  /**
   * Added by Story 1.11, once the deposit itself confirms or reverts
   * on-chain, completing FR10's record (no personally identifying
   * data, per NFR7, a vault contract address and a status are not
   * PII). Absent until then.
   */
  destinationVault?: string;
  depositStatus?: 'completed' | 'reverted';
  depositConfirmedAt?: string;
}

export class InvalidCorrelationRecordError extends Error {}

/**
 * Validates a record's shape before it is ever persisted, never
 * persisted unvalidated (this story's own AC). Deliberately not a
 * generic schema library, every field here maps to a specific,
 * already-established requirement.
 */
export function validateCorrelationRecord(
  record: Partial<CorrelationRecord>
): CorrelationRecord {
  const missing = (
    ['stellarAddress', 'originChainAsset', 'settledAmount', 'settledAt', 'integratorId', 'correlationId'] as const
  ).filter((key) => !record[key]);

  if (missing.length > 0) {
    throw new InvalidCorrelationRecordError(
      `Correlation record missing required field(s): ${missing.join(', ')}`
    );
  }
  if (!record.stellarAddress!.startsWith('G')) {
    throw new InvalidCorrelationRecordError('stellarAddress must be a Stellar G-address.');
  }
  if (Number.isNaN(Date.parse(record.settledAt!))) {
    throw new InvalidCorrelationRecordError('settledAt must be a valid ISO timestamp.');
  }
  if (record.destinationVault !== undefined && !record.destinationVault) {
    throw new InvalidCorrelationRecordError('destinationVault must be a non-empty string when present.');
  }
  if (
    record.depositStatus !== undefined &&
    record.depositStatus !== 'completed' &&
    record.depositStatus !== 'reverted'
  ) {
    throw new InvalidCorrelationRecordError('depositStatus must be "completed" or "reverted" when present.');
  }
  if (record.depositConfirmedAt !== undefined && Number.isNaN(Date.parse(record.depositConfirmedAt))) {
    throw new InvalidCorrelationRecordError('depositConfirmedAt must be a valid ISO timestamp when present.');
  }

  return record as CorrelationRecord;
}

export class InvalidTransactionXDRError extends Error {}

/**
 * AC #3/#4: the only function in the codebase allowed to produce a
 * `ValidatedTransactionXDR`. A base64-encoded Soroban transaction
 * envelope XDR always starts with `AAAA` (the envelope type discriminant
 * for `ENVELOPE_TYPE_TX`, 0 as a 4-byte big-endian XDR union tag), a
 * real structural check, not just "is this a non-empty string".
 */
export function validateTransactionXDR(xdr: string): ValidatedTransactionXDR {
  if (!xdr || typeof xdr !== 'string') {
    throw new InvalidTransactionXDRError('Transaction XDR is missing or not a string.');
  }
  if (!xdr.startsWith('AAAA')) {
    throw new InvalidTransactionXDRError(
      'Transaction XDR does not look like a valid Soroban envelope (expected base64 starting with "AAAA").'
    );
  }
  return xdr as ValidatedTransactionXDR;
}

/**
 * Rule #9: this is a convenience cache write, never the sole record of
 * a settlement, everything here remains independently reconstructable
 * from Horizon/1Click's own integrator-attributed records (AC #9). A
 * failed write here must never be treated as a failed settlement.
 */
export async function writeCorrelationRecord(record: Partial<CorrelationRecord>): Promise<void> {
  const validated = validateCorrelationRecord(record);
  const redis = getRedisClient();
  await redis.set(`correlation:${validated.stellarAddress}`, JSON.stringify(validated));
}

export class CorrelationRecordNotFoundError extends Error {}

/**
 * Story 1.11: merges the deposit's outcome into the record Story 1.8
 * already wrote for this address, re-validating the merged whole
 * before persisting (AC #3), never appending an unvalidated partial.
 * Rule #9 still applies, a failed update here is never treated as a
 * failed deposit; the caller decides how to handle that.
 */
export async function updateCorrelationRecordWithDeposit(
  stellarAddress: string,
  update: {
    destinationVault: string;
    depositStatus: 'completed' | 'reverted';
    depositConfirmedAt: string;
  }
): Promise<void> {
  const redis = getRedisClient();
  const key = `correlation:${stellarAddress}`;
  const existing = await redis.get<CorrelationRecord>(key);
  if (!existing) {
    throw new CorrelationRecordNotFoundError(
      `No correlation record found for ${stellarAddress} to update with the deposit outcome.`
    );
  }
  const merged = validateCorrelationRecord({ ...existing, ...update });
  await redis.set(key, JSON.stringify(merged));
}
