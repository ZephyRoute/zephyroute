import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { signCorrelationReadChallenge } = vi.hoisted(() => ({
  signCorrelationReadChallenge: vi.fn(),
}));

vi.mock('@/lib/wallet-kit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wallet-kit')>('@/lib/wallet-kit');
  return { ...actual, signCorrelationReadChallenge };
});

const { useCorrelationResume } = await import('./useCorrelationResume');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('useCorrelationResume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs the challenge before ever querying the gateway (AC #1)', async () => {
    signCorrelationReadChallenge.mockResolvedValue('sig');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { status: 'none' })));
    const { result } = renderHook(() => useCorrelationResume());

    await act(async () => {
      await result.current.check('GDEPOSITOR');
    });

    expect(signCorrelationReadChallenge).toHaveBeenCalledWith(
      'GDEPOSITOR',
      expect.stringMatching(/^zephyroute:correlation-read:\d+$/)
    );
    expect(fetch).toHaveBeenCalled();
  });

  it('never queries the gateway at all when signing the challenge fails', async () => {
    const { ChallengeSigningError } = await import('@/lib/wallet-kit');
    signCorrelationReadChallenge.mockRejectedValue(
      new ChallengeSigningError('Could not sign the verification challenge.')
    );
    vi.stubGlobal('fetch', vi.fn());
    const { result } = renderHook(() => useCorrelationResume());

    await act(async () => {
      await result.current.check('GDEPOSITOR');
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces a resumable deposit, so the caller can skip straight to signing', async () => {
    signCorrelationReadChallenge.mockResolvedValue('sig');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { status: 'resumable-deposit', settledAmount: '10000000', originChainAsset: 'nep141:eth.origin' })
        )
    );
    const { result } = renderHook(() => useCorrelationResume());

    await act(async () => {
      await result.current.check('GDEPOSITOR');
    });

    expect(result.current.status).toBe('resumable-deposit');
    expect(result.current.resumableDeposit).toEqual({
      settledAmount: '10000000',
      originChainAsset: 'nep141:eth.origin',
    });
  });

  it('surfaces the current earning position, presenting nothing as needing to resume', async () => {
    signCorrelationReadChallenge.mockResolvedValue('sig');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { status: 'earning', vaultAddress: 'CVAULT', dfTokens: 100 }))
    );
    const { result } = renderHook(() => useCorrelationResume());

    await act(async () => {
      await result.current.check('GDEPOSITOR');
    });

    expect(result.current.status).toBe('earning');
    expect(result.current.earningPosition).toEqual({ vaultAddress: 'CVAULT', dfTokens: 100 });
  });
});
