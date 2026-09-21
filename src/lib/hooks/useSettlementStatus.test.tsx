import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getAssetBalance = vi.fn();

vi.mock('@/lib/horizon', () => ({
  getAssetBalance,
}));

const { useSettlementStatus } = await import('./useSettlementStatus');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useSettlementStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports settled once the balance increases past the baseline, using Horizon ledger time', async () => {
    getAssetBalance.mockResolvedValue({ balance: '19.969', lastModifiedTime: '2026-09-21T12:00:00Z' });

    const { result } = renderHook(
      () =>
        useSettlementStatus({
          accountId: 'GABCDEF',
          asset: { code: 'USDC', issuer: 'GISSUER' },
          baselineBalance: '10.000',
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.settled).toBe(true);
      expect(result.current.settledAt).toBe('2026-09-21T12:00:00Z');
    });
  });

  it('does not report settled while the balance still equals the baseline', async () => {
    getAssetBalance.mockResolvedValue({ balance: '10.000', lastModifiedTime: '2026-09-21T12:00:00Z' });

    const { result } = renderHook(
      () =>
        useSettlementStatus({
          accountId: 'GABCDEF',
          asset: { code: 'USDC', issuer: 'GISSUER' },
          baselineBalance: '10.000',
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => expect(getAssetBalance).toHaveBeenCalled());
    expect(result.current.settled).toBe(false);
  });

  it('does not poll at all when disabled', async () => {
    renderHook(
      () =>
        useSettlementStatus({
          accountId: 'GABCDEF',
          asset: { code: 'USDC', issuer: 'GISSUER' },
          baselineBalance: '10.000',
          enabled: false,
        }),
      { wrapper }
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getAssetBalance).not.toHaveBeenCalled();
  });
});
