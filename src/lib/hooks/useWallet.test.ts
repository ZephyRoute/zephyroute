import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

class MockWalletConnectionError extends Error {}

const connectWallet = vi.fn();
const disconnectWallet = vi.fn();
const onWalletDisconnected = vi.fn(() => () => {});

vi.mock('@/lib/wallet-kit', () => ({
  connectWallet,
  disconnectWallet,
  onWalletDisconnected,
  WalletConnectionError: MockWalletConnectionError,
}));

const { useWallet } = await import('./useWallet');

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts disconnected with no address', () => {
    const { result } = renderHook(() => useWallet());

    expect(result.current.status).toBe('disconnected');
    expect(result.current.address).toBeNull();
  });

  it('transitions to connected with the address once connect resolves', async () => {
    connectWallet.mockResolvedValue('GABCDEFTESTPUBLICADDRESS');
    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
      expect(result.current.address).toBe('GABCDEFTESTPUBLICADDRESS');
    });
  });

  it('surfaces failure explicitly rather than retrying silently', async () => {
    connectWallet.mockRejectedValue(new MockWalletConnectionError('cancelled'));
    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.address).toBeNull();
      expect(result.current.errorMessage).toBe('cancelled');
    });
    expect(connectWallet).toHaveBeenCalledOnce();
  });

  it('clears address and status on disconnect', async () => {
    connectWallet.mockResolvedValue('GABCDEFTESTPUBLICADDRESS');
    disconnectWallet.mockResolvedValue(undefined);
    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });
    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.status).toBe('disconnected');
    expect(result.current.address).toBeNull();
  });
});
