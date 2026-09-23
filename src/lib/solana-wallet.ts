import { getWallets } from '@wallet-standard/app';
import { StandardConnect } from '@wallet-standard/features';
import type { StandardConnectFeature } from '@wallet-standard/features';
import { SolanaSignAndSendTransaction } from '@solana/wallet-standard-features';
import type { SolanaSignAndSendTransactionFeature } from '@solana/wallet-standard-features';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import bs58 from 'bs58';

export class SolanaWalletError extends Error {}

const SOLANA_MAINNET = 'solana:mainnet';

/**
 * Issue: Solana origin support. Phantom's own docs (checked live,
 * `docs.phantom.com/solana/sending-a-transaction`) state that new
 * integrations should use the Wallet Standard rather than the legacy
 * `window.phantom.solana` object, since several of its methods "are
 * not supported in the wallet standard implementation and may be
 * removed in a future release." The Wallet Standard is also
 * wallet-agnostic (Phantom, Solflare, Backpack, and others all
 * register through it), the same reason this project uses Stellar
 * Wallets Kit rather than hand-rolling against one specific Stellar
 * wallet's own injected object.
 */
function findSolanaWallet(): Wallet {
  const wallet = getWallets()
    .get()
    .find(
      (candidate) =>
        candidate.chains.includes(SOLANA_MAINNET) &&
        StandardConnect in candidate.features &&
        SolanaSignAndSendTransaction in candidate.features
    );
  if (!wallet) {
    throw new SolanaWalletError('No Solana wallet extension detected.');
  }
  return wallet;
}

/**
 * Opens the wallet's own connection prompt and resolves with the
 * authorized account. Never sees or requests a private key, the same
 * non-custodial invariant every other wallet-connection path in this
 * project already holds.
 */
export async function connectSolanaWallet(): Promise<WalletAccount> {
  const wallet = findSolanaWallet();
  try {
    const feature = wallet.features[StandardConnect] as StandardConnectFeature[typeof StandardConnect];
    const { accounts } = await feature.connect();
    const account = accounts[0];
    if (!account) {
      throw new SolanaWalletError('No account was authorized.');
    }
    return account;
  } catch (cause) {
    if (cause instanceof SolanaWalletError) throw cause;
    throw new SolanaWalletError('Could not connect your Solana wallet.', { cause });
  }
}

/**
 * Signs and submits an already-built, unsigned transaction via the
 * connected wallet, returning the transaction signature as the
 * conventional base58 string (matching how Solana Explorer and every
 * other Solana tool displays it), not the raw bytes the wallet
 * standard itself returns.
 */
export async function signAndSendSolanaTransaction(
  account: WalletAccount,
  serializedTransaction: Uint8Array
): Promise<string> {
  const wallet = findSolanaWallet();
  try {
    const feature = wallet.features[
      SolanaSignAndSendTransaction
    ] as SolanaSignAndSendTransactionFeature[typeof SolanaSignAndSendTransaction];
    const [result] = await feature.signAndSendTransaction({
      account,
      transaction: serializedTransaction,
      chain: SOLANA_MAINNET,
    });
    if (!result) {
      throw new SolanaWalletError('The wallet did not return a signature.');
    }
    return bs58.encode(result.signature);
  } catch (cause) {
    if (cause instanceof SolanaWalletError) throw cause;
    throw new SolanaWalletError('Signature was cancelled or failed.', { cause });
  }
}
