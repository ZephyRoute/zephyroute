import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ManualFundingFallback } from './ManualFundingFallback';

describe('ManualFundingFallback', () => {
  it('shows the user their own address as the funding destination, never a Zephyroute-owned one', () => {
    render(
      <ManualFundingFallback
        stellarAddress="GOWNACCOUNTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        asset={{ code: 'USDC', issuer: 'GISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }}
        checking={false}
        onCheckAgain={vi.fn()}
      />
    );

    expect(screen.getByText('GOWNACCOUNTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBeInTheDocument();
    expect(screen.getByText(/never holds or touches your funds/)).toBeInTheDocument();
  });

  it('includes the trustline step with the real asset issuer for a non-native asset', () => {
    render(
      <ManualFundingFallback
        stellarAddress="GOWNACCOUNT"
        asset={{ code: 'USDC', issuer: 'GISSUER123' }}
        checking={false}
        onCheckAgain={vi.fn()}
      />
    );

    expect(screen.getByText(/trustline for USDC/)).toBeInTheDocument();
    expect(screen.getByText('GISSUER123')).toBeInTheDocument();
  });

  it('skips the trustline step entirely for native XLM, which needs none', () => {
    render(
      <ManualFundingFallback
        stellarAddress="GOWNACCOUNT"
        asset={{ code: 'XLM' }}
        checking={false}
        onCheckAgain={vi.fn()}
      />
    );

    expect(screen.queryByText(/trustline/)).not.toBeInTheDocument();
  });

  it('calls onCheckAgain when the user confirms they funded their account', async () => {
    const user = userEvent.setup();
    const onCheckAgain = vi.fn();
    render(
      <ManualFundingFallback
        stellarAddress="GOWNACCOUNT"
        asset={{ code: 'XLM' }}
        checking={false}
        onCheckAgain={onCheckAgain}
      />
    );

    await user.click(screen.getByRole('button', { name: "I've funded my account, check again" }));
    expect(onCheckAgain).toHaveBeenCalledOnce();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(
      <ManualFundingFallback
        stellarAddress="GOWNACCOUNT"
        asset={{ code: 'USDC', issuer: 'GISSUER123' }}
        checking={false}
        onCheckAgain={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
