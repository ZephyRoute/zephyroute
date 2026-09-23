import { describe, expect, it, vi, beforeEach } from 'vitest';

const { scan, mget } = vi.hoisted(() => ({ scan: vi.fn(), mget: vi.fn() }));

vi.mock('@/lib/redis', () => ({ getRedisClient: () => ({ scan, mget }) }));

const { computeTractionMetrics, TractionMetricsError } = await import('./traction-metrics');

describe('computeTractionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all zeros, never a Redis call to mget, when there are no correlation records at all', async () => {
    scan.mockResolvedValue(['0', []]);

    const result = await computeTractionMetrics();

    expect(result).toEqual({
      cumulativeAttributableVolume: '0',
      netNewTVL: '0',
      uniqueFundedAddresses: 0,
      recurrenceRate7d: null,
      recurrenceRate30d: null,
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

  it('reports recurrence rate as honestly not trackable, never a fabricated number', async () => {
    scan.mockResolvedValue(['0', []]);

    const result = await computeTractionMetrics();

    expect(result.recurrenceRate7d).toBeNull();
    expect(result.recurrenceRate30d).toBeNull();
  });

  it('wraps a Redis outage as TractionMetricsError, never a silent failure', async () => {
    scan.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(computeTractionMetrics()).rejects.toBeInstanceOf(TractionMetricsError);
  });
});
