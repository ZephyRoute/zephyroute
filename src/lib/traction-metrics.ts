import { getRedisClient } from '@/lib/redis';
import type { CorrelationRecord } from '@/lib/validation';

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
   * Story 3.2, AC: recurrence rate is not computable with the current
   * data model. Every correlation record lives at a single address-
   * keyed Redis entry (`correlation:{stellarAddress}`), overwritten on
   * each write, so a second flow from the same address destroys the
   * first flow's record rather than adding to a history. `null` here
   * is an honest "not yet trackable", never a fabricated number (see
   * Issue #22 for the data-model change this would actually need).
   */
  recurrenceRate7d: null;
  recurrenceRate30d: null;
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

  if (keys.length === 0) {
    return {
      cumulativeAttributableVolume: '0',
      netNewTVL: '0',
      uniqueFundedAddresses: 0,
      recurrenceRate7d: null,
      recurrenceRate30d: null,
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
    recurrenceRate7d: null,
    recurrenceRate30d: null,
  };
}
