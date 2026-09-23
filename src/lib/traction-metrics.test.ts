import { describe, expect, it, vi, beforeEach } from 'vitest';

const { scan, mget, zrange } = vi.hoisted(() => ({
  scan: vi.fn(),
  mget: vi.fn(),
  zrange: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({ getRedisClient: () => ({ scan, mget, zrange }) }));

const { computeTractionMetrics, TractionMetricsError } = await import('./traction-metrics');

describe('computeTractionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zrange.mockResolvedValue([]);
  });

  it('returns all zeros, never a Redis call to mget, when there are no correlation records at all', async () => {
    scan.mockResolvedValue(['0', []]);

    const result = await computeTractionMetrics();

    expect(result).toEqual({
      cumulativeAttributableVolume: '0',
      netNewTVL: '0',
      uniqueFundedAddresses: 0,
      recurrenceRate7d: 0,
      recurrenceRate30d: 0,
    });
    expect(mget).not.toHaveBeenCalled();
  });

  it('sums settled volume across every record, and net-new TVL + unique addresses only across completed deposits', async () => {
    scan.mockResolvedValue(['0', ['correlation:GADDR1', 'correlation:GADDR2', 'correlation:GADDR3']]);
    mget.mockResolvedValue([
      {
        stellarAddress: 'GADDR1',
        originChainAsset: 'nep141:eth.origin',
        settledAmount: '10000000',
        settledAt: '2026-09-22T00:00:00Z',
        integratorId: 'zephyroute',
        correlationId: 'c1',
        destinationVault: 'CVAULT',
        depositStatus: 'completed',
      },
      {
        stellarAddress: 'GADDR2',
        originChainAsset: 'nep141:eth.origin',
        settledAmount: '5000000',
        settledAt: '2026-09-22T00:00:00Z',
        integratorId: 'zephyroute',
        correlationId: 'c2',
        // Settled but never deposited: counted in cumulative volume,
        // never in net-new TVL or the funded-address set.
      },
      {
        stellarAddress: 'GADDR3',
        originChainAsset: 'nep141:btc.origin',
        settledAmount: '2000000',
        settledAt: '2026-09-22T00:00:00Z',
        integratorId: 'zephyroute',
        correlationId: 'c3',
        destinationVault: 'CVAULT',
        depositStatus: 'reverted',
      },
    ]);

    const result = await computeTractionMetrics();

    expect(result.cumulativeAttributableVolume).toBe('17000000');
    expect(result.netNewTVL).toBe('10000000');
    expect(result.uniqueFundedAddresses).toBe(1);
  });

  it('skips a null entry from a key that disappeared between scan and mget, never crashing', async () => {
    scan.mockResolvedValue(['0', ['correlation:GADDR1']]);
    mget.mockResolvedValue([null]);

    const result = await computeTractionMetrics();

    expect(result.cumulativeAttributableVolume).toBe('0');
  });

  it('paginates through multiple scan cursors until reaching 0, never stopping early', async () => {
    scan
      .mockResolvedValueOnce(['17', ['correlation:GADDR1']])
      .mockResolvedValueOnce(['0', ['correlation:GADDR2']]);
    mget.mockResolvedValue([null, null]);

    await computeTractionMetrics();

    expect(scan).toHaveBeenCalledTimes(2);
    expect(mget).toHaveBeenCalledWith('correlation:GADDR1', 'correlation:GADDR2');
  });

  describe('recurrence rate (Issue #22 follow-on: an append-only settlement log)', () => {
    it('reports 0, never null, when the window has settlements but none recur', async () => {
      scan.mockResolvedValue(['0', []]);
      zrange.mockResolvedValue(['GADDR1:c1', 'GADDR2:c2']);

      const result = await computeTractionMetrics();

      expect(result.recurrenceRate7d).toBe(0);
    });

    it('computes the share of addresses that settled more than once in the window', async () => {
      scan.mockResolvedValue(['0', []]);
      // GADDR1 recurs (2 settlements), GADDR2 and GADDR3 do not: 1 of 3
      // distinct addresses recurred.
      zrange.mockResolvedValue(['GADDR1:c1', 'GADDR1:c2', 'GADDR2:c3', 'GADDR3:c4']);

      const result = await computeTractionMetrics();

      expect(result.recurrenceRate7d).toBeCloseTo(1 / 3);
    });

    it('queries the 7-day and 30-day windows independently, never conflating them', async () => {
      scan.mockResolvedValue(['0', []]);
      zrange.mockResolvedValueOnce(['GADDR1:c1']).mockResolvedValueOnce(['GADDR1:c1', 'GADDR2:c2']);

      await computeTractionMetrics();

      expect(zrange).toHaveBeenCalledTimes(2);
      const [, min7, max7] = zrange.mock.calls[0]!;
      const [, min30] = zrange.mock.calls[1]!;
      expect(max7 - min7).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -2);
      expect(min30).toBeLessThan(min7);
    });

    it('reports null, never a fabricated 0, when the settlement log itself cannot be read', async () => {
      scan.mockResolvedValue(['0', []]);
      zrange.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await computeTractionMetrics();

      expect(result.recurrenceRate7d).toBeNull();
      expect(result.recurrenceRate30d).toBeNull();
    });
  });

  it('wraps a Redis outage as TractionMetricsError, never a silent failure', async () => {
    scan.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(computeTractionMetrics()).rejects.toBeInstanceOf(TractionMetricsError);
  });
});
