import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { useAccount, useConnect, useSendTransaction } = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useConnect: vi.fn(),
  useSendTransaction: vi.fn(),
}));

vi.mock('wagmi', () => ({ useAccount, useConnect, useSendTransaction }));

const { useOriginSwap } = await import('./useOriginSwap');

import { SUPPORTED_ROUTES } from '@/lib/routes';

const ethereumUsdcRoute = SUPPORTED_ROUTES.find((r) => r.label === 'Ethereum USDC to Stellar USDC')!;

describe('useOriginSwap', () => {
  const connectAsync = vi.fn();
  const sendTransactionAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useConnect.mockReturnValue({
      connectors: [{ id: 'injected' }],
      connectAsync,
    });
    useSendTransaction.mockReturnValue({ sendTransactionAsync });
  });

  it('connects the EVM wallet first when not yet connected, then signs and submits', async () => {
    useAccount.mockReturnValue({ address: undefined, isConnected: false });
    sendTransactionAsync.mockResolvedValue('0xtxhash');

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000');
    });

    expect(connectAsync).toHaveBeenCalledOnce();
    expect(sendTransactionAsync).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('submitted');
    expect(result.current.txHash).toBe('0xtxhash');
  });

  it('targets the selected route\'s own chain, never whatever chain the wallet happens to be on (PRD Open Question 3 follow-on)', async () => {
    useAccount.mockReturnValue({ address: '0xuser', isConnected: true });
    sendTransactionAsync.mockResolvedValue('0xtxhash');
    const arbitrumRoute = SUPPORTED_ROUTES.find((r) => r.label === 'Arbitrum USDC to Stellar USDC')!;

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(
        arbitrumRoute,
        '0x1111111111111111111111111111111111111111',
        '10000000'
      );
    });

    expect(sendTransactionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: arbitrumRoute.chainId })
    );
    expect(arbitrumRoute.chainId).toBe(42161);
  });

  it('skips reconnecting when the wallet is already connected', async () => {
    useAccount.mockReturnValue({ address: '0xuser', isConnected: true });
    sendTransactionAsync.mockResolvedValue('0xtxhash');

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000');
    });

    expect(connectAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe('submitted');
  });

  it('surfaces a cancelled or failed signature explicitly, never a silent failure', async () => {
    useAccount.mockReturnValue({ address: '0xuser', isConnected: true });
    sendTransactionAsync.mockRejectedValue(new Error('User rejected the request'));

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await expect(
        result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000')
      ).rejects.toThrow();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.errorMessage).toBe('User rejected the request');
  });
});
