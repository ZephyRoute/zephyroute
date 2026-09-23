import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const noop = vi.fn();

vi.mock('@/lib/hooks/useWallet', () => ({
  useWallet: () => ({
    address: null,
    status: 'failed',
    errorMessage: 'Wallet connection was cancelled or failed.',
    connect: noop,
    disconnect: noop,
  }),
}));
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
  useEmbeddedWalletOnboarding: () => ({
    status: 'idle',
    errorMessage: null,
    stellarAddress: null,
    providerUnavailable: false,
    onboard: noop,
  }),
}));
vi.mock('@/lib/horizon', () => ({ getAssetBalance: noop }));

const { ZephyrouteFlow } = await import('./ZephyrouteFlow');

describe('ZephyrouteFlow', () => {
  it('surfaces a failed wallet connection as a visible alert, never a silent broken state (Story 4.2 AC #3)', () => {
    render(<ZephyrouteFlow />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Wallet connection was cancelled or failed.'
    );
  });
});
