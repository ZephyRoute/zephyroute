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
    amountOut: '9969000',
    amountOutFormatted: '9.969 USDC',
    amountOutUsd: '9.969',
    minAmountOut: '9869000',
    timeEstimate: 60,
    deadline: new Date().toISOString(),
    refundFee: '1000',
  },
};

describe('QuoteDisplay', () => {
  it('shows the compressed numbers-first headline verbatim', () => {
    render(<QuoteDisplay quote={quote} />);

    expect(screen.getByText(/9\.969 USDC for 10 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/Min received: 9869000/)).toBeInTheDocument();
  });

  it('reveals every verbatim quote field, unrounded, under "See full quote"', async () => {
    const user = userEvent.setup();
    render(<QuoteDisplay quote={quote} />);

    await user.click(screen.getByRole('button', { name: 'See full quote' }));

    expect(screen.getByText('10000000')).toBeInTheDocument();
    expect(screen.getByText('9969000')).toBeInTheDocument();
    expect(screen.getByText('9869000')).toBeInTheDocument();
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
