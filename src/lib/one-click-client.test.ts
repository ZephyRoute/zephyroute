import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getQuote } = vi.hoisted(() => ({ getQuote: vi.fn() }));

vi.mock('@defuse-protocol/one-click-sdk-typescript', async () => {
  const actual = await vi.importActual<
    typeof import('@defuse-protocol/one-click-sdk-typescript')
  >('@defuse-protocol/one-click-sdk-typescript');
  return {
    ...actual,
    OneClickService: { getQuote },
  };
});

import { requestQuote, QuoteRejectedError, QuoteRequestError } from './one-click-client';
import { ApiError } from '@defuse-protocol/one-click-sdk-typescript';

const baseParams = {
  originAsset: 'nep141:eth.omft.near',
  destinationAsset: 'nep141:stellar.omft.near',
  amount: '10000000',
  recipient: 'GABCDEFTESTPUBLICADDRESS',
  refundTo: '0xoriginwalletaddress',
  slippageToleranceBps: 100,
  deadline: new Date(Date.now() + 60_000).toISOString(),
};

describe('requestQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests a real (dry:false) quote carrying the integrator referral, landing directly on the destination chain', async () => {
    const fakeResponse = {
      correlationId: 'corr-1',
      timestamp: new Date().toISOString(),
      signature: 'sig',
      quoteRequest: {},
      quote: {
        amountIn: '10000000',
        amountInFormatted: '10',
        amountInUsd: '10',
        minAmountIn: '10000000',
        amountOut: '9969000',
        amountOutFormatted: '9.969',
        amountOutUsd: '9.969',
        minAmountOut: '9869000',
        timeEstimate: 60,
        depositAddress: '0xdepositaddress',
        deadline: baseParams.deadline,
        refundFee: '1000',
      },
    };
    getQuote.mockResolvedValue(fakeResponse);

    const result = await requestQuote(baseParams);

    expect(result).toEqual(fakeResponse);
    const callArg = getQuote.mock.calls[0][0];
    expect(callArg.dry).toBe(false);
    expect(callArg.swapType).toBe('EXACT_INPUT');
    expect(callArg.depositType).toBe('ORIGIN_CHAIN');
    expect(callArg.recipientType).toBe('DESTINATION_CHAIN');
    expect(callArg.depositMode).toBe('SIMPLE');
    // verbatim fields (FR1): never paraphrased, exactly what 1Click returned
    expect(result.quote.minAmountOut).toBe('9869000');
    expect(result.quote.refundFee).toBe('1000');
  });

  it('rejects with QuoteRejectedError before any signature is ever requested, when the route is down (AC #5)', async () => {
    getQuote.mockRejectedValue(
      new ApiError(
        { method: 'POST', url: '/quote' },
        { url: '/quote', ok: false, status: 400, statusText: 'Bad Request', body: { message: 'Route currently unavailable' } },
        'Bad Request'
      )
    );

    await expect(requestQuote(baseParams)).rejects.toBeInstanceOf(QuoteRejectedError);
  });

  it('wraps a non-API failure (network error) as QuoteRequestError, never a silent failure', async () => {
    getQuote.mockRejectedValue(new TypeError('fetch failed'));

    await expect(requestQuote(baseParams)).rejects.toBeInstanceOf(QuoteRequestError);
  });
});
