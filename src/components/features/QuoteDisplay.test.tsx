import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QuoteDisplay } from './QuoteDisplay';
import type { QuoteResponse } from '@defuse-protocol/one-click-sdk-typescript';

const quote: QuoteResponse = {
  correlationId: 'corr-1',
  timestamp: new Date().toISOString(),
  signature: 'sig',
  quoteRequest: {
    dry: false,
    swapType: 'EXACT_INPUT' as never,
    slippageTolerance: 100,
    originAsset: 'nep141:eth.omft.near',
    depositType: 'ORIGIN_CHAIN' as never,
    destinationAsset: 'nep141:stellar.omft.near',
    amount: '10000000',
    refundTo: '0xoriginwalletaddress',
    refundType: 'ORIGIN_CHAIN' as never,
    recipient: 'GABCDEFTESTPUBLICADDRESS',
    recipientType: 'DESTINATION_CHAIN' as never,
    deadline: new Date().toISOString(),
  },
  quote: {
    amountIn: '10000000',
    amountInFormatted: '10 USDC',
    amountInUsd: '10',
    minAmountIn: '10000000',
    // 7 decimals, the real, live-verified convention for a Stellar
    // USDC destination (confirmed via a real `dry: true` 1Click quote,
    // amountOut '99758879' / amountOutFormatted '9.9758879', a 1:1e7
    // ratio), not the 6-decimal convention an earlier, unverified
    // version of this fixture assumed (zephyroute-internal
    // improvement-ideas/verify-1click-amount-formatted-decimals.md,
    // now resolved).
    amountOut: '99690000',
    amountOutFormatted: '9.969 USDC',
    amountOutUsd: '9.969',
    minAmountOut: '98690000',
    timeEstimate: 60,
    deadline: new Date().toISOString(),
    refundFee: '1000',
  },
};

describe('QuoteDisplay', () => {
  it('shows the compressed numbers-first headline verbatim', () => {
    render(<QuoteDisplay quote={quote} />);

    expect(screen.getByText(/9\.969 USDC for 10 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/Min received: 98690000/)).toBeInTheDocument();
  });

  it('shows the full plain-language sentence, embedding the same real numbers, for a new user (Story 2.1, AC #2)', () => {
    render(<QuoteDisplay quote={quote} variant="new" />);

    expect(
      screen.getByText(
        /You'll receive 9\.969 USDC in your Stellar account for the 10 USDC you're sending, in about 60 seconds\./
      )
    ).toBeInTheDocument();
  });

  it('reveals every verbatim quote field, unrounded, under "See full quote"', async () => {
    const user = userEvent.setup();
    render(<QuoteDisplay quote={quote} />);

    await user.click(screen.getByRole('button', { name: 'See full quote' }));

    expect(screen.getByText('10000000')).toBeInTheDocument();
    expect(screen.getByText('99690000')).toBeInTheDocument();
    expect(screen.getByText('98690000')).toBeInTheDocument();
    expect(screen.getByText('100 bps')).toBeInTheDocument();
    expect(screen.getByText('0xoriginwalletaddress')).toBeInTheDocument();
    expect(screen.getByText('ORIGIN_CHAIN')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<QuoteDisplay quote={quote} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
