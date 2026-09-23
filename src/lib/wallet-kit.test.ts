import { describe, expect, it, vi, beforeEach } from 'vitest';

const { authModal, init, disconnect, on, signTransaction } = vi.hoisted(() => ({
  authModal: vi.fn(),
  init: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    init,
    authModal,
    disconnect,
    on,
    signTransaction,
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

describe('signDepositTransaction', () => {
  let capturedDisconnectCallback: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedDisconnectCallback = undefined;
    on.mockImplementation((_event: string, callback: () => void) => {
      capturedDisconnectCallback = callback;
      return vi.fn();
    });
  });

  it('resolves with the signed XDR on a normal signature', async () => {
    signTransaction.mockResolvedValue({ signedTxXdr: 'AAAASIGNED' });
    const { signDepositTransaction } = await import('./wallet-kit');

    const signed = await signDepositTransaction('AAAAUNSIGNED', 'GDEPOSITOR');

    expect(signed).toBe('AAAASIGNED');
  });

  it('throws a "disconnected"-reason error, never assuming success, when the wallet disconnects before the signature resolves', async () => {
    signTransaction.mockImplementation(
      () =>
        new Promise((resolve) => {
          capturedDisconnectCallback?.();
          resolve({ signedTxXdr: 'AAAASIGNED' });
        })
    );
    const { signDepositTransaction } = await import('./wallet-kit');

    await expect(signDepositTransaction('AAAAUNSIGNED', 'GDEPOSITOR')).rejects.toMatchObject({
      reason: 'disconnected',
    });
  });

  it('throws a "cancelled"-reason error, never a silent failure, when the signature is cancelled or fails', async () => {
    signTransaction.mockRejectedValue(new Error('User rejected the request'));
    const { signDepositTransaction } = await import('./wallet-kit');

    await expect(signDepositTransaction('AAAAUNSIGNED', 'GDEPOSITOR')).rejects.toMatchObject({
      reason: 'cancelled',
    });
  });
});
