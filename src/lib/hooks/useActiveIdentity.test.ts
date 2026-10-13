import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseWalletResult } from '@/lib/hooks/useWallet';
import type { UseEmbeddedWalletOnboardingResult } from '@/lib/hooks/useEmbeddedWalletOnboarding';

const useWalletMock = vi.fn();
const useEmbeddedWalletOnboardingMock = vi.fn();
const signChallengeMessage = vi.fn();
const signMessageWithDfns = vi.fn();

vi.mock('@/lib/hooks/useWallet', () => ({ useWallet: () => useWalletMock() }));
vi.mock('@/lib/hooks/useEmbeddedWalletOnboarding', () => ({
  useEmbeddedWalletOnboarding: () => useEmbeddedWalletOnboardingMock(),
}));
vi.mock('@/lib/wallet-kit', () => ({ signChallengeMessage }));
vi.mock('@/lib/dfns-message-signing', () => ({ signMessageWithDfns }));

const { useActiveIdentity } = await import('./useActiveIdentity');

function walletResult(overrides: Partial<UseWalletResult> = {}): UseWalletResult {
  return {
    address: null,
    status: 'disconnected',
    errorMessage: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}
function onboardingResult(
  overrides: Partial<UseEmbeddedWalletOnboardingResult> = {}
): UseEmbeddedWalletOnboardingResult {
  return {
    status: 'idle',
    errorMessage: null,
    stellarAddress: null,
    walletId: null,
    providerUnavailable: false,
    onboard: vi.fn(),
    ...overrides,
  };
}

describe('useActiveIdentity', () => {
  it('reflects the connected wallet-kit address when no DFNS onboarding has completed', () => {
    useWalletMock.mockReturnValue(
      walletResult({ address: 'GWALLETKIT', status: 'connected' })
    );
    useEmbeddedWalletOnboardingMock.mockReturnValue(onboardingResult());

    const { result } = renderHook(() => useActiveIdentity());

    expect(result.current.address).toBe('GWALLETKIT');
    expect(result.current.source).toBe('wallet-kit');
    expect(result.current.dfnsWalletId).toBeNull();
    expect(result.current.status).toBe('connected');
  });

  it('switches to the DFNS-onboarded address once onboarding completes, superseding wallet-kit (Issue #16, gap #1)', () => {
    useWalletMock.mockReturnValue(walletResult({ address: null, status: 'disconnected' }));
    useEmbeddedWalletOnboardingMock.mockReturnValue(
      onboardingResult({ status: 'completed', stellarAddress: 'GDFNS', walletId: 'w1' })
    );

    const { result } = renderHook(() => useActiveIdentity());

    expect(result.current.address).toBe('GDFNS');
    expect(result.current.source).toBe('dfns');
    expect(result.current.dfnsWalletId).toBe('w1');
    expect(result.current.status).toBe('connected');
  });

  it('prefers a completed DFNS onboarding even if a wallet-kit wallet is also connected', () => {
    useWalletMock.mockReturnValue(walletResult({ address: 'GWALLETKIT', status: 'connected' }));
    useEmbeddedWalletOnboardingMock.mockReturnValue(
      onboardingResult({ status: 'completed', stellarAddress: 'GDFNS', walletId: 'w1' })
    );

    const { result } = renderHook(() => useActiveIdentity());

    expect(result.current.address).toBe('GDFNS');
    expect(result.current.source).toBe('dfns');
  });

  it('reports null source, never a stale one, while disconnected and no onboarding has completed', () => {
    useWalletMock.mockReturnValue(walletResult());
    useEmbeddedWalletOnboardingMock.mockReturnValue(onboardingResult());

    const { result } = renderHook(() => useActiveIdentity());

    expect(result.current.address).toBeNull();
    expect(result.current.source).toBeNull();
    expect(result.current.status).toBe('disconnected');
  });

  it('surfaces a failed wallet-kit connection error when DFNS was never attempted', () => {
    useWalletMock.mockReturnValue(
      walletResult({ status: 'failed', errorMessage: 'Wallet connection was cancelled or failed.' })
    );
    useEmbeddedWalletOnboardingMock.mockReturnValue(onboardingResult());

    const { result } = renderHook(() => useActiveIdentity());

    expect(result.current.status).toBe('failed');
    expect(result.current.errorMessage).toBe('Wallet connection was cancelled or failed.');
  });

  describe('signMessage (security review follow-on: correlation write-proof dispatch)', () => {
    it('dispatches to signChallengeMessage for a wallet-kit identity', async () => {
      useWalletMock.mockReturnValue(walletResult({ address: 'GWALLETKIT', status: 'connected' }));
      useEmbeddedWalletOnboardingMock.mockReturnValue(onboardingResult());
      signChallengeMessage.mockResolvedValue('sig');
      const { result } = renderHook(() => useActiveIdentity());

      let signature: string | undefined;
      await act(async () => {
        signature = await result.current.signMessage('zephyroute:correlation-write:1');
      });

      expect(signature).toBe('sig');
      expect(signChallengeMessage).toHaveBeenCalledWith(
        'GWALLETKIT',
        'zephyroute:correlation-write:1'
      );
      expect(signMessageWithDfns).not.toHaveBeenCalled();
    });

    it('dispatches to signMessageWithDfns for a DFNS identity, never wallet-kit', async () => {
      useWalletMock.mockReturnValue(walletResult());
      useEmbeddedWalletOnboardingMock.mockReturnValue(
        onboardingResult({ status: 'completed', stellarAddress: 'GDFNS', walletId: 'w1' })
      );
      signMessageWithDfns.mockResolvedValue('sig');
      const { result } = renderHook(() => useActiveIdentity());

      let signature: string | undefined;
      await act(async () => {
        signature = await result.current.signMessage('zephyroute:correlation-write:1');
      });

      expect(signature).toBe('sig');
      expect(signMessageWithDfns).toHaveBeenCalledWith('w1', 'zephyroute:correlation-write:1');
      expect(signChallengeMessage).not.toHaveBeenCalled();
    });

    it('rejects, never silently no-oping, when there is no active identity to sign with', async () => {
      useWalletMock.mockReturnValue(walletResult());
      useEmbeddedWalletOnboardingMock.mockReturnValue(onboardingResult());
      const { result } = renderHook(() => useActiveIdentity());

      await expect(result.current.signMessage('zephyroute:correlation-write:1')).rejects.toThrow();
      expect(signChallengeMessage).not.toHaveBeenCalled();
      expect(signMessageWithDfns).not.toHaveBeenCalled();
    });
  });
});
