import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useQuote } from './useQuote';

const VALID_PARAMS = {
  originAsset: 'nep141:eth.origin',
  destinationAsset: 'nep245:usdc.stellar',
  amount: '1000000',
  recipient: 'GDESTINATION',
  refundTo: '0xrefund',
  slippageToleranceBps: 100,
  deadline: '2026-01-01T00:00:00Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useQuote', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls /api/quote, never the 1Click SDK directly (Issue #3), and stores the quote on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { quote: { amountOut: '999' } }));
    const { result } = renderHook(() => useQuote());

    await act(async () => {
      await result.current.requestQuoteFor(VALID_PARAMS);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/quote',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(VALID_PARAMS) })
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
      expect(result.current.quote).toEqual({ quote: { amountOut: '999' } });
    });
  });

  it('sets status to rejected on a QUOTE_REJECTED envelope, not a generic failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(422, { error: { code: 'QUOTE_REJECTED', message: 'Route unavailable.' } })
    );
    const { result } = renderHook(() => useQuote());

    await act(async () => {
      await result.current.requestQuoteFor(VALID_PARAMS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('rejected');
      expect(result.current.errorMessage).toBe('Route unavailable.');
      expect(result.current.quote).toBeNull();
    });
  });

  it('sets status to failed on a network error, never leaving the request hanging silently', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useQuote());

    await act(async () => {
      await result.current.requestQuoteFor(VALID_PARAMS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.errorMessage).toBe('Could not reach the quote service. Try again.');
    });
  });
});
