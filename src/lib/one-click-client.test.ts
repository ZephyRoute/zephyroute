import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { getQuote, getHistory } = vi.hoisted(() => ({ getQuote: vi.fn(), getHistory: vi.fn() }));

vi.mock('@defuse-protocol/one-click-sdk-typescript', async () => {
  const actual = await vi.importActual<
    typeof import('@defuse-protocol/one-click-sdk-typescript')
  >('@defuse-protocol/one-click-sdk-typescript');
  return {
    ...actual,
    OneClickService: { getQuote },
    AccountService: { getHistory },
  };
});

import {
  requestQuote,
  QuoteRejectedError,
  QuoteRequestError,
  MissingIntegratorIdError,
  findAttributedSettlement,
  HistoryQueryError,
} from './one-click-client';
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
  const originalIntegratorId = process.env.ONECLICK_INTEGRATOR_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ONECLICK_INTEGRATOR_ID = 'zephyroute';
  });

  afterEach(() => {
    process.env.ONECLICK_INTEGRATOR_ID = originalIntegratorId;
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
    // FR2 (Story 1.6): zero requests sent anonymously
    expect(callArg.referral).toBe('zephyroute');
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

  it('refuses to send any request at all when the integrator ID is not configured (FR2, Story 1.6: zero anonymous requests)', async () => {
    delete process.env.ONECLICK_INTEGRATOR_ID;

    await expect(requestQuote(baseParams)).rejects.toBeInstanceOf(MissingIntegratorIdError);
    expect(getQuote).not.toHaveBeenCalled();
  });
});

describe('findAttributedSettlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds the history item matching this recipient address, ignoring unrelated ones (AC #9)', async () => {
    getHistory.mockResolvedValue({
      items: [
        { recipient: 'GOTHERADDRESS', originAsset: 'nep141:eth.origin', amountOutFormatted: '1 USDC', createdAt: '2026-09-22T00:00:00Z' },
        { recipient: 'GDEPOSITOR', originAsset: 'nep141:eth.origin', amountOutFormatted: '9.969 USDC', createdAt: '2026-09-22T00:05:00Z' },
      ],
    });

    const result = await findAttributedSettlement('GDEPOSITOR');

    expect(result).toEqual({
      originChainAsset: 'nep141:eth.origin',
      settledAmountFormatted: '9.969 USDC',
      settledAt: '2026-09-22T00:05:00Z',
    });
  });

  it('returns null when no history item matches this address, never fabricating one', async () => {
    getHistory.mockResolvedValue({ items: [] });

    expect(await findAttributedSettlement('GDEPOSITOR')).toBeNull();
  });

  it('wraps a query failure as HistoryQueryError, never a silent failure', async () => {
    getHistory.mockRejectedValue(new Error('1Click is down'));

    await expect(findAttributedSettlement('GDEPOSITOR')).rejects.toBeInstanceOf(HistoryQueryError);
  });
});
