import { describe, expect, it, vi, beforeEach } from 'vitest';

const { computeTractionMetrics } = vi.hoisted(() => ({ computeTractionMetrics: vi.fn() }));

vi.mock('@/lib/traction-metrics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/traction-metrics')>(
    '@/lib/traction-metrics'
  );
  return { ...actual, computeTractionMetrics };
});

const { GET } = await import('./route');

describe('GET /api/traction-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the computed metrics on success', async () => {
    const metrics = {
      cumulativeAttributableVolume: '17000000',
      netNewTVL: '10000000',
      uniqueFundedAddresses: 1,
      recurrenceRate7d: null,
      recurrenceRate30d: null,
    };
    computeTractionMetrics.mockResolvedValue(metrics);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(metrics);
  });

  it('wraps a computation failure as a 502, never a raw stack trace', async () => {
    const { TractionMetricsError } = await import('@/lib/traction-metrics');
    computeTractionMetrics.mockRejectedValue(new TractionMetricsError('ECONNREFUSED at socket'));

    const response = await GET();

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('TRACTION_METRICS_FAILED');
  });
});
