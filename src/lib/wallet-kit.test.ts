import { describe, expect, it, vi, beforeEach } from 'vitest';

const { authModal, init, disconnect, on } = vi.hoisted(() => ({
  authModal: vi.fn(),
  init: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
}));

vi.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    init,
    authModal,
    disconnect,
    on,
  },
}));

vi.mock('@creit.tech/stellar-wallets-kit/types', () => ({
  Networks: { PUBLIC: 'Public Global Stellar Network ; September 2015' },
  KitEventType: { DISCONNECT: 'DISCONNECT' },
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/utils', () => ({
  defaultModules: () => [],
}));

describe('wallet-kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connectWallet resolves with only the public address, nothing else from the wallet', async () => {
    authModal.mockResolvedValue({ address: 'GABCDEFTESTPUBLICADDRESS' });
    const { connectWallet } = await import('./wallet-kit');

    const address = await connectWallet();

    expect(address).toBe('GABCDEFTESTPUBLICADDRESS');
    expect(typeof address).toBe('string');
  });

  it('connectWallet throws a WalletConnectionError, never a silent failure, when the modal is cancelled or fails', async () => {
    authModal.mockRejectedValue(new Error('User closed the modal'));
    const { connectWallet, WalletConnectionError } = await import('./wallet-kit');

    await expect(connectWallet()).rejects.toBeInstanceOf(WalletConnectionError);
  });

  it('disconnectWallet delegates to the kit', async () => {
    const { disconnectWallet } = await import('./wallet-kit');

    await disconnectWallet();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
