import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { Networks, KitEventType } from '@creit.tech/stellar-wallets-kit/types';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

let initialized = false;

/**
 * Initializes the singleton Stellar Wallets Kit once per page load. Safe
 * to call multiple times, the underlying kit is a static class, so this
 * just guards against redundant `init()` calls.
 *
 * The kit only ever receives a public Stellar address from the wallet
 * extension (AC #1, FR5); it never requests, sees, or stores a private
 * key or seed phrase, that stays entirely inside the wallet extension.
 */
export function initWalletKit(): void {
  if (initialized) return;
  StellarWalletsKit.init({
    modules: defaultModules(),
    network: Networks.PUBLIC,
  });
  initialized = true;
}

export class WalletConnectionError extends Error {}

/**
 * Opens the wallet-selection modal and resolves with the connected
 * public address. Never returns or exposes anything else from the
 * wallet.
 */
export async function connectWallet(): Promise<string> {
  initWalletKit();
  try {
    const { address } = await StellarWalletsKit.authModal();
    return address;
  } catch (cause) {
    throw new WalletConnectionError('Wallet connection was cancelled or failed.', {
      cause,
    });
  }
}

export async function disconnectWallet(): Promise<void> {
  await StellarWalletsKit.disconnect();
}

export function onWalletDisconnected(callback: () => void): () => void {
  initWalletKit();
  return StellarWalletsKit.on(KitEventType.DISCONNECT, callback);
}
