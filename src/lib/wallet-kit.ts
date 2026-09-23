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

export class DepositSigningError extends Error {
  /**
   * Distinguishes a mid-signature disconnect from an ordinary
   * cancel/failure without the caller having to string-match the
   * message (Story 1.10, AC #3: a disconnect must show an explicit
   * reconnect state, never a generic failure).
   */
  readonly reason: 'disconnected' | 'cancelled';

  constructor(message: string, reason: 'disconnected' | 'cancelled', options?: ErrorOptions) {
    super(message, options);
    this.reason = reason;
  }
}

/**
 * Story 1.10, AC #3: a disconnect mid-signature is detected via the
 * kit's own DISCONNECT event racing the signature promise, never
 * inferred from the promise's outcome alone, so a disconnect never
 * reads as "signature succeeded" or "signature just failed".
 */
export async function signDepositTransaction(
  xdr: string,
  address: string
): Promise<string> {
  initWalletKit();
  let disconnected = false;
  const unsubscribe = onWalletDisconnected(() => {
    disconnected = true;
  });
  try {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.PUBLIC,
      address,
    });
    if (disconnected) {
      throw new DepositSigningError(
        'Wallet disconnected before the signature completed.',
        'disconnected'
      );
    }
    return signedTxXdr;
  } catch (cause) {
    if (disconnected) {
      throw new DepositSigningError(
        'Wallet disconnected before the signature completed.',
        'disconnected',
        { cause }
      );
    }
    throw new DepositSigningError('Signature was cancelled or failed.', 'cancelled', { cause });
  } finally {
    unsubscribe();
  }
}

export class ChallengeSigningError extends Error {}

/**
 * Story 1.12, AC #1: signs the fixed `zephyroute:correlation-read:`
 * challenge (SEP-53 message signing, not a transaction), the proof the
 * gateway requires before returning any status for this address,
 * closing the enumeration/privacy gap an open address-only lookup
 * would otherwise have.
 */
export async function signCorrelationReadChallenge(
  address: string,
  message: string
): Promise<string> {
  initWalletKit();
  try {
    const { signedMessage } = await StellarWalletsKit.signMessage(message, {
      networkPassphrase: Networks.PUBLIC,
      address,
    });
    return signedMessage;
  } catch (cause) {
    throw new ChallengeSigningError('Could not sign the verification challenge.', { cause });
  }
}
