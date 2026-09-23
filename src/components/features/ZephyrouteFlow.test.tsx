import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const noop = vi.fn();
const useWalletMock = vi.fn();
const useEmbeddedWalletOnboardingMock = vi.fn();

vi.mock('@/lib/hooks/useWallet', () => ({ useWallet: () => useWalletMock() }));
vi.mock('@/lib/hooks/useQuote', () => ({
  useQuote: () => ({ quote: null, status: 'idle', errorMessage: null, requestQuoteFor: noop }),
}));
vi.mock('@/lib/hooks/useTrustlineCheck', () => ({
  useTrustlineCheck: () => ({
    status: 'idle',
    errorMessage: null,
    everMissing: false,
    check: noop,
  }),
}));
vi.mock('@/lib/hooks/useOriginSwap', () => ({
  useOriginSwap: () => ({ status: 'idle', errorMessage: null, signAndSubmit: noop }),
}));
vi.mock('@/lib/hooks/useSettlementStatus', () => ({
  useSettlementStatus: () => ({ settled: false, settledAt: null }),
}));
vi.mock('@/lib/hooks/useDepositSigning', () => ({
  useDepositSigning: () => ({
    status: 'idle',
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
    start: noop,
    sign: noop,
  }),
}));
vi.mock('@/lib/hooks/useCorrelationResume', () => ({
  useCorrelationResume: () => ({
    status: 'idle',
    errorMessage: null,
    earningPosition: null,
    resumableDeposit: null,
    check: noop,
  }),
}));
vi.mock('@/lib/hooks/useEmbeddedWalletOnboarding', () => ({
  useEmbeddedWalletOnboarding: () => useEmbeddedWalletOnboardingMock(),
}));
vi.mock('@/lib/horizon', () => ({ getAssetBalance: noop }));

const { ZephyrouteFlow } = await import('./ZephyrouteFlow');

const IDLE_ONBOARDING = {
  status: 'idle',
  errorMessage: null,
  stellarAddress: null,
  walletId: null,
  providerUnavailable: false,
  onboard: noop,
};

describe('ZephyrouteFlow', () => {
  beforeEach(() => {
    useEmbeddedWalletOnboardingMock.mockReturnValue(IDLE_ONBOARDING);
  });

  it('surfaces a failed wallet connection as a visible alert, never a silent broken state (Story 4.2 AC #3)', () => {
    useWalletMock.mockReturnValue({
      address: null,
      status: 'failed',
      errorMessage: 'Wallet connection was cancelled or failed.',
      connect: noop,
      disconnect: noop,
    });

    render(<ZephyrouteFlow />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Wallet connection was cancelled or failed.'
    );
  });

  it('offers the DFNS account-setup fork before any wallet is connected, reachable by a zero-wallet visitor (Issue #16, gap #1)', () => {
    useWalletMock.mockReturnValue({
      address: null,
      status: 'disconnected',
      errorMessage: null,
      connect: noop,
      disconnect: noop,
    });

    render(<ZephyrouteFlow />);

    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my Stellar account' })).toBeInTheDocument();
  });

  it('advances into the main flow using the DFNS-onboarded address once onboarding completes, never staying stuck at the fork (Issue #16, gap #1)', () => {
    useWalletMock.mockReturnValue({
      address: null,
      status: 'disconnected',
      errorMessage: null,
      connect: noop,
      disconnect: noop,
    });
    useEmbeddedWalletOnboardingMock.mockReturnValue({
      ...IDLE_ONBOARDING,
      status: 'completed',
      stellarAddress: 'GDFNSNEWACCOUNT',
      walletId: 'w1',
    });

    render(<ZephyrouteFlow />);

    expect(screen.getByRole('status')).toHaveTextContent('Connected: GDFNSNEWACCOUNT');
    expect(screen.queryByRole('button', { name: 'Create my Stellar account' })).not.toBeInTheDocument();
  });
});
