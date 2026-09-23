import { describe, expect, it, vi } from 'vitest';
import { StandardConnect } from '@wallet-standard/features';
import { SolanaSignAndSendTransaction } from '@solana/wallet-standard-features';
import type { Wallet, WalletAccount } from '@wallet-standard/base';

const get = vi.fn();

vi.mock('@wallet-standard/app', () => ({ getWallets: () => ({ get }) }));

const { connectSolanaWallet, signAndSendSolanaTransaction, SolanaWalletError } = await import(
  './solana-wallet'
);

const ACCOUNT: WalletAccount = {
  address: 'GDEPOSITORSOLANAADDRESS',
  publicKey: new Uint8Array(32),
  chains: ['solana:mainnet'],
  features: [StandardConnect, SolanaSignAndSendTransaction],
};

function makeSolanaWallet(overrides: Partial<Wallet['features']> = {}): Wallet {
  const connect = vi.fn().mockResolvedValue({ accounts: [ACCOUNT] });
  const signAndSendTransaction = vi.fn().mockResolvedValue([{ signature: new Uint8Array([1, 2, 3]) }]);
  return {
    version: '1.0.0',
    name: 'Test Wallet',
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet'],
    accounts: [],
    features: {
      [StandardConnect]: { version: '1.0.0', connect },
      [SolanaSignAndSendTransaction]: {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy'],
        signAndSendTransaction,
      },
      ...overrides,
    },
  } as unknown as Wallet;
}

describe('solana-wallet', () => {
  describe('connectSolanaWallet', () => {
    it('connects via the Wallet Standard and resolves with the authorized account, never a private key', async () => {
      const wallet = makeSolanaWallet();
      get.mockReturnValue([wallet]);

      const account = await connectSolanaWallet();

      expect(account).toEqual(ACCOUNT);
      expect(
        (wallet.features[StandardConnect] as { connect: ReturnType<typeof vi.fn> }).connect
      ).toHaveBeenCalledOnce();
    });

    it('throws SolanaWalletError, never a silent failure, when no Solana-capable wallet is registered', async () => {
      get.mockReturnValue([]);

      await expect(connectSolanaWallet()).rejects.toBeInstanceOf(SolanaWalletError);
    });

    it('ignores a registered wallet that does not support Solana mainnet', async () => {
      const evmOnlyWallet = makeSolanaWallet();
      Object.assign(evmOnlyWallet, { chains: ['eip155:1'] });
      get.mockReturnValue([evmOnlyWallet]);

      await expect(connectSolanaWallet()).rejects.toBeInstanceOf(SolanaWalletError);
    });
  });

  describe('signAndSendSolanaTransaction', () => {
    it('signs and sends via the wallet, returning the signature as base58, not raw bytes', async () => {
      const wallet = makeSolanaWallet();
      get.mockReturnValue([wallet]);

      const signature = await signAndSendSolanaTransaction(ACCOUNT, new Uint8Array([9, 9, 9]));

      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      const feature = wallet.features[SolanaSignAndSendTransaction] as {
        signAndSendTransaction: ReturnType<typeof vi.fn>;
      };
      expect(feature.signAndSendTransaction).toHaveBeenCalledWith({
        account: ACCOUNT,
        transaction: new Uint8Array([9, 9, 9]),
        chain: 'solana:mainnet',
      });
    });

    it('wraps a cancelled or failed signature in SolanaWalletError', async () => {
      const wallet = makeSolanaWallet();
      (
        wallet.features[SolanaSignAndSendTransaction] as { signAndSendTransaction: ReturnType<typeof vi.fn> }
      ).signAndSendTransaction.mockRejectedValue(new Error('User rejected'));
      get.mockReturnValue([wallet]);

      await expect(
        signAndSendSolanaTransaction(ACCOUNT, new Uint8Array([9, 9, 9]))
      ).rejects.toBeInstanceOf(SolanaWalletError);
    });
  });
});
