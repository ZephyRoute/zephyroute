import { getRedisClient } from '@/lib/redis';
import { SETTLEMENT_LOG_KEY, type CorrelationRecord } from '@/lib/validation';

export class TractionMetricsError extends Error {}

export interface TractionMetrics {
  /** Sum of `settledAmount` across every correlation record, whether
   * or not the deposit itself later completed: every unit of value
   * that arrived through Zephyroute's attributed 1Click integrator ID.
   * A raw-unit sum across whichever destination assets settled (USDC,
   * XLM), not normalized to one currency; every supported route
   * currently settles to USDC except one XLM route (`lib/routes.ts`),
   * a real simplification worth revisiting once route volume actually
   * diversifies, not before. */
  cumulativeAttributableVolume: string;
  /** Sum of `settledAmount` across records whose deposit actually
   * completed, a proxy for value now genuinely earning in the vault.
   * Same mixed-asset caveat as `cumulativeAttributableVolume`. */
  netNewTVL: string;
  uniqueFundedAddresses: number;
  /**
   * Issue #22 follow-on: the share of addresses that settled more than
   * once within the window, out of every address that settled at all
   * within it, `0` when data exists but nobody recurred, `null` only
   * when the append-only settlement log (`SETTLEMENT_LOG_KEY`) itself
   * couldn't be read at all. Addresses that settled before the log
   * started being written (any record written before this fix shipped)
   * are undercounted, not overcounted, an honest degradation, never a
   * fabricated number.
   */
  recurrenceRate7d: number | null;
  recurrenceRate30d: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Groups the settlement log's members (`{address}:{correlationId}`) by
 * address within a score-range window and returns the share that
 * appear more than once, the recurrence-rate definition this metric
 * uses throughout.
 */
async function computeRecurrenceRate(
  redis: ReturnType<typeof getRedisClient>,
  windowMs: number
): Promise<number | null> {
  const now = Date.now();
  let members: string[];
  try {
    members = await redis.zrange<string[]>(SETTLEMENT_LOG_KEY, now - windowMs, now, {
      byScore: true,
    });
  } catch {
    return null;
  }

  if (members.length === 0) return 0;

  const settlementsByAddress = new Map<string, number>();
  for (const member of members) {
    const address = member.split(':')[0];
    if (!address) continue;
    settlementsByAddress.set(address, (settlementsByAddress.get(address) ?? 0) + 1);
  }

  const distinctAddresses = settlementsByAddress.size;
  if (distinctAddresses === 0) return 0;
  const recurring = Array.from(settlementsByAddress.values()).filter((count) => count >= 2).length;
  return recurring / distinctAddresses;
}

/**
 * Story 3.2: scans every correlation record and aggregates the three
 * metrics genuinely computable from the current data model. These are
 * the same raw records the product's own resume/earning views already
 * read (Story 1.12), never a separately maintained or rounded figure
 * (the AC's own requirement).
 */
export async function computeTractionMetrics(): Promise<TractionMetrics> {
  const redis = getRedisClient();

  const keys: string[] = [];
  let cursor = '0';
  try {
    do {
      const [nextCursor, batch] = await redis.scan(cursor, {
        match: 'correlation:*',
        count: 100,
      });
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (cause) {
    throw new TractionMetricsError('Could not read correlation records. Try again.', { cause });
  }

  const [recurrenceRate7d, recurrenceRate30d] = await Promise.all([
    computeRecurrenceRate(redis, 7 * DAY_MS),
    computeRecurrenceRate(redis, 30 * DAY_MS),
  ]);

  if (keys.length === 0) {
    return {
      cumulativeAttributableVolume: '0',
      netNewTVL: '0',
      uniqueFundedAddresses: 0,
      recurrenceRate7d,
      recurrenceRate30d,
    };
  }

  let records: (CorrelationRecord | null)[];
  try {
    records = await redis.mget<(CorrelationRecord | null)[]>(...keys);
  } catch (cause) {
    throw new TractionMetricsError('Could not read correlation records. Try again.', { cause });
  }

  let cumulativeAttributableVolume = BigInt(0);
  let netNewTVL = BigInt(0);
  const fundedAddresses = new Set<string>();

  for (const record of records) {
    if (!record) continue;
    cumulativeAttributableVolume += BigInt(record.settledAmount);
    if (record.depositStatus === 'completed') {
      netNewTVL += BigInt(record.settledAmount);
      fundedAddresses.add(record.stellarAddress);
    }
  }

  return {
    cumulativeAttributableVolume: cumulativeAttributableVolume.toString(),
    netNewTVL: netNewTVL.toString(),
    uniqueFundedAddresses: fundedAddresses.size,
    recurrenceRate7d,
    recurrenceRate30d,
  };
}
