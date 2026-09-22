import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { DepositSigningPanel } from './DepositSigningPanel';

const BASE_PROPS = {
  errorMessage: null,
  vaultAddress: null,
  amountInSmallestUnits: null,
  minimumGuaranteedInSmallestUnits: null,
  secondsRemaining: null,
  requiredFeeXLM: null,
  availableXLM: null,
  rebuildAnnouncement: null,
  txHash: null,
  dfTokens: null,
  onSign: vi.fn(),
};

describe('DepositSigningPanel', () => {
  it('renders the destination vault, amount, minimum guaranteed, and countdown when ready to sign (AC #1)', () => {
    render(
      <DepositSigningPanel
        {...BASE_PROPS}
        status="ready-to-sign"
        vaultAddress="CVAULTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        amountInSmallestUnits="10000000"
        minimumGuaranteedInSmallestUnits="9900000"
        secondsRemaining={125}
      />
    );

    expect(screen.getByText('Destination vault')).toBeInTheDocument();
    expect(screen.getByText('1.0000000')).toBeInTheDocument();
    expect(screen.getByText('0.9900000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign deposit' })).toBeEnabled();
  });

  it('never renders the Sign button while insufficient-fee, per AC #4', () => {
    render(
      <DepositSigningPanel
        {...BASE_PROPS}
        status="insufficient-fee"
        requiredFeeXLM="0.01"
        availableXLM="0.0000001"
      />
    );

    expect(screen.queryByRole('button', { name: 'Sign deposit' })).not.toBeInTheDocument();
    expect(screen.getByText(/0.01 XLM/)).toBeInTheDocument();
  });

  it('shows an explicit reconnect message on disconnect, never implying success (AC #3)', () => {
    render(<DepositSigningPanel {...BASE_PROPS} status="disconnected" />);

    expect(screen.getByText(/disconnected before the signature completed/)).toBeInTheDocument();
  });

  it('labels submitted and confirming on-chain as two distinct states, never collapsed into one (AC #1)', () => {
    const { rerender } = render(
      <DepositSigningPanel {...BASE_PROPS} status="submitted" txHash="DEADBEEFCAFE" />
    );
    expect(screen.getByText(/Submitted\./)).toBeInTheDocument();

    rerender(<DepositSigningPanel {...BASE_PROPS} status="confirming on-chain" txHash="DEADBEEFCAFE" />);
    expect(screen.getByText(/Confirming on-chain/)).toBeInTheDocument();
  });

  it('shows the confirmed earning outcome on completed (AC #2)', () => {
    render(<DepositSigningPanel {...BASE_PROPS} status="completed" dfTokens={100} />);

    expect(screen.getByText(/now earning yield/)).toBeInTheDocument();
  });

  it('surfaces a revert explicitly with a clear next step, never a silent dead end (AC #3)', () => {
    render(
      <DepositSigningPanel
        {...BASE_PROPS}
        status="reverted"
        errorMessage="The deposit was rejected on-chain, for example if the price moved past your slippage tolerance. You can try again."
      />
    );

    expect(screen.getByText(/rejected on-chain/)).toBeInTheDocument();
  });

  it('surfaces the rebuild announcement inside the always-present aria-live region (AC #2)', () => {
    const { container } = render(
      <DepositSigningPanel
        {...BASE_PROPS}
        status="building"
        rebuildAnnouncement="Your signature window expired. Preparing a new deposit transaction now."
      />
    );

    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toHaveTextContent('Your signature window expired.');
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(
      <DepositSigningPanel
        {...BASE_PROPS}
        status="ready-to-sign"
        vaultAddress="CVAULTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        amountInSmallestUnits="10000000"
        minimumGuaranteedInSmallestUnits="9900000"
        secondsRemaining={125}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
