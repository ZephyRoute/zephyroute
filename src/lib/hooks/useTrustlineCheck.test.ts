import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const hasTrustline = vi.fn();

vi.mock('@/lib/horizon', () => ({
  hasTrustline,
}));

const { useTrustlineCheck } = await import('./useTrustlineCheck');

describe('useTrustlineCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves to present when the trustline exists, proceeding straight to quoting', async () => {
    hasTrustline.mockResolvedValue(true);
    const { result } = renderHook(() => useTrustlineCheck());

    let checkResult: boolean = false;
    await act(async () => {
      checkResult = await result.current.check('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });
    });

    expect(checkResult).toBe(true);
    await waitFor(() => expect(result.current.status).toBe('present'));
  });

  it('resolves to missing when the trustline does not exist, routing to onboarding', async () => {
    hasTrustline.mockResolvedValue(false);
    const { result } = renderHook(() => useTrustlineCheck());

    let checkResult: boolean = true;
    await act(async () => {
      checkResult = await result.current.check('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });
    });

    expect(checkResult).toBe(false);
    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.everMissing).toBe(true);
  });

  it('keeps everMissing true even after a later check comes back present, per Story 2.1 AC #2', async () => {
    hasTrustline.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useTrustlineCheck());

    await act(async () => {
      await result.current.check('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });
    });
    await waitFor(() => expect(result.current.status).toBe('missing'));

    await act(async () => {
      await result.current.check('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });
    });

    await waitFor(() => expect(result.current.status).toBe('present'));
    expect(result.current.everMissing).toBe(true);
  });

  it('surfaces a Horizon outage explicitly rather than silently blocking or proceeding', async () => {
    hasTrustline.mockRejectedValue(new Error('Horizon is down'));
    const { result } = renderHook(() => useTrustlineCheck());

    await act(async () => {
      await result.current.check('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.errorMessage).toBe('Horizon is down');
    });
  });
});
