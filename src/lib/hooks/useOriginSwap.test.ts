import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const {
  wagmiConfig,
  connect,
  getConnection,
  getConnectors,
  sendTransaction,
  connectSolanaWallet,
  signAndSendSolanaTransaction,
  buildSolanaSwapTransaction,
} = vi.hoisted(() => ({
  wagmiConfig: { chains: [] },
  connect: vi.fn(),
  getConnection: vi.fn(),
  getConnectors: vi.fn(),
  sendTransaction: vi.fn(),
  connectSolanaWallet: vi.fn(),
  signAndSendSolanaTransaction: vi.fn(),
  buildSolanaSwapTransaction: vi.fn(),
}));

vi.mock('@/lib/wagmi-config', () => ({ wagmiConfig }));
vi.mock('wagmi/actions', () => ({ connect, getConnection, getConnectors, sendTransaction }));
vi.mock('@/lib/solana-wallet', () => ({ connectSolanaWallet, signAndSendSolanaTransaction }));
vi.mock('@/lib/solana-swap', () => ({ buildSolanaSwapTransaction }));

const { useOriginSwap } = await import('./useOriginSwap');

import { SUPPORTED_ROUTES } from '@/lib/routes';

const ethereumUsdcRoute = SUPPORTED_ROUTES.find((r) => r.label === 'Ethereum USDC to Stellar USDC')!;

describe('useOriginSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConnectors.mockReturnValue([{ id: 'injected' }]);
  });

  it('connects the EVM wallet first when not yet connected, then signs and submits', async () => {
    getConnection.mockReturnValue({ address: undefined, isConnected: false });
    sendTransaction.mockResolvedValue('0xtxhash');

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000');
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledWith(wagmiConfig, { connector: { id: 'injected' } });
    expect(sendTransaction).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('submitted');
    expect(result.current.txHash).toBe('0xtxhash');
  });

  it('targets the selected route\'s own chain, never whatever chain the wallet happens to be on (PRD Open Question 3 follow-on)', async () => {
    getConnection.mockReturnValue({ address: '0xuser', isConnected: true });
    sendTransaction.mockResolvedValue('0xtxhash');
    const arbitrumRoute = SUPPORTED_ROUTES.find((r) => r.label === 'Arbitrum USDC to Stellar USDC')!;

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(
        arbitrumRoute,
        '0x1111111111111111111111111111111111111111',
        '10000000'
      );
    });

    expect(sendTransaction).toHaveBeenCalledWith(
      wagmiConfig,
      expect.objectContaining({ chainId: arbitrumRoute.chainId })
    );
    expect(arbitrumRoute.chainId).toBe(42161);
  });

  it('skips reconnecting when the wallet is already connected', async () => {
    getConnection.mockReturnValue({ address: '0xuser', isConnected: true });
    sendTransaction.mockResolvedValue('0xtxhash');

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000');
    });

    expect(connect).not.toHaveBeenCalled();
    expect(result.current.status).toBe('submitted');
  });

  it('surfaces a cancelled or failed signature explicitly, never a silent failure', async () => {
    getConnection.mockReturnValue({ address: '0xuser', isConnected: true });
    sendTransaction.mockRejectedValue(new Error('User rejected the request'));

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await expect(
        result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000')
      ).rejects.toThrow();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.errorMessage).toBe('User rejected the request');
  });

  it('surfaces "no EVM wallet extension detected" explicitly when no connector is available', async () => {
    getConnection.mockReturnValue({ address: undefined, isConnected: false });
    getConnectors.mockReturnValue([]);

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await expect(
        result.current.signAndSubmit(ethereumUsdcRoute, '0x1111111111111111111111111111111111111111', '10000000')
      ).rejects.toThrow('No EVM wallet extension detected.');
    });

    expect(result.current.status).toBe('failed');
    expect(connect).not.toHaveBeenCalled();
  });

  it('dispatches a Solana route to the Wallet Standard path, never wagmi (Issue: Solana origin support)', async () => {
    const solanaRoute = SUPPORTED_ROUTES.find((r) => r.originChain === 'solana')!;
    connectSolanaWallet.mockResolvedValue({ address: 'GSOLANADEPOSITOR' });
    buildSolanaSwapTransaction.mockResolvedValue(new Uint8Array([1, 2, 3]));
    signAndSendSolanaTransaction.mockResolvedValue('5SigBase58');

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await result.current.signAndSubmit(solanaRoute, 'GSOLANADEPOSITADDRESS', '10000000');
    });

    expect(connectSolanaWallet).toHaveBeenCalledOnce();
    expect(buildSolanaSwapTransaction).toHaveBeenCalledWith(
      solanaRoute,
      'GSOLANADEPOSITOR',
      'GSOLANADEPOSITADDRESS',
      '10000000'
    );
    expect(signAndSendSolanaTransaction).toHaveBeenCalledOnce();
    expect(connect).not.toHaveBeenCalled();
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(result.current.status).toBe('submitted');
    expect(result.current.txHash).toBe('5SigBase58');
  });

  it('surfaces a failed Solana wallet connection explicitly, never a silent failure', async () => {
    const solanaRoute = SUPPORTED_ROUTES.find((r) => r.originChain === 'solana')!;
    connectSolanaWallet.mockRejectedValue(new Error('No Solana wallet extension detected.'));

    const { result } = renderHook(() => useOriginSwap());

    await act(async () => {
      await expect(
        result.current.signAndSubmit(solanaRoute, 'GSOLANADEPOSITADDRESS', '10000000')
      ).rejects.toThrow();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.errorMessage).toBe('No Solana wallet extension detected.');
  });
});
