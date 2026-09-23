import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  NotFoundError,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import type { AssetIdentifier } from '@/lib/horizon';
import { attachEd25519Signature } from '@/lib/stellar-signature';

export class SponsorConfigError extends Error {}
export class OnboardingTransactionError extends Error {}

/**
 * Story 2.2 (founder-authorized 2026-09-22): Zephyroute's own treasury
 * account, sponsoring each new user's account and trustline reserve so
 * the new user never needs to hold XLM. A real, spend-capable secret
 * key, required but unset by default, throws rather than silently
 * proceeding without it, the same discipline `DEFINDEX_VAULT_ADDRESS`
 * already established.
 */
function requiredSponsorKeypair(): Keypair {
  const secret = process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY;
  if (!secret) {
    throw new SponsorConfigError(
      'ZEPHYROUTE_SPONSOR_SECRET_KEY is not configured. The treasury account that sponsors new-user onboarding must be confirmed and funded before this can run.'
    );
  }
  return Keypair.fromSecret(secret);
}

const server = new Horizon.Server('https://horizon.stellar.org');

export interface UnsignedOnboardingTransaction {
  /** The sponsor's own signature is already attached; the new
   * account's signature (from DFNS) is still needed before submission. */
  partiallySignedXdr: string;
  /** Hex-encoded 32-byte transaction hash: what the new account's
   * wallet must sign next. */
  hashHex: string;
}

/**
 * Story 2.2, AC #1: builds a single Stellar transaction that creates
 * the new account, funds its base reserve, and establishes the
 * destination trustline (skipped for native XLM, which needs none),
 * all sponsored so the new account never needs to hold XLM itself
 * (CAP-33 sponsored reserves, `beginSponsoringFutureReserves` /
 * `endSponsoringFutureReserves`). The sponsor's own signature is
 * attached here; the new account's signature is added later once
 * DFNS signs the returned hash (Story 2.2's own two-step flow).
 */
export async function buildOnboardingTransaction(
  newAccountPublicKey: string,
  asset: AssetIdentifier
): Promise<UnsignedOnboardingTransaction> {
  const sponsor = requiredSponsorKeypair();

  let sponsorAccount: Horizon.AccountResponse;
  try {
    sponsorAccount = await server.loadAccount(sponsor.publicKey());
  } catch (cause) {
    if (cause instanceof NotFoundError) {
      throw new SponsorConfigError(
        'The sponsor treasury account does not exist on the network yet. Fund it before onboarding can run.'
      );
    }
    throw new OnboardingTransactionError('Could not read the sponsor account. Try again.', {
      cause,
    });
  }

  const builder = new TransactionBuilder(sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.beginSponsoringFutureReserves({
        sponsoredId: newAccountPublicKey,
        source: sponsor.publicKey(),
      })
    )
    .addOperation(
      Operation.createAccount({
        destination: newAccountPublicKey,
        startingBalance: '0',
        source: sponsor.publicKey(),
      })
    );

  if (asset.issuer) {
    builder.addOperation(
      Operation.changeTrust({
        asset: new Asset(asset.code, asset.issuer),
        source: newAccountPublicKey,
      })
    );
  }

  builder.addOperation(
    Operation.endSponsoringFutureReserves({ source: newAccountPublicKey })
  );
  builder.setTimeout(300);

  const transaction = builder.build();
  transaction.sign(sponsor);

  const hashHex = Buffer.from(transaction.hash()).toString('hex');
  return { partiallySignedXdr: transaction.toXDR(), hashHex };
}

/**
 * Story 2.2: attaches the new account's own ed25519 signature (r || s
 * from DFNS's `generateSignature`, or its `encoded` field when
 * present) to the sponsor-signed transaction, then submits it, the
 * same submission path `submitDepositTransaction` already uses.
 */
export async function attachSignatureAndSubmit(
  partiallySignedXdr: string,
  newAccountPublicKey: string,
  signature: Uint8Array
): Promise<{ hash: string; successful: boolean }> {
  const transaction = attachEd25519Signature(partiallySignedXdr, newAccountPublicKey, signature);

  try {
    const response = await server.submitTransaction(transaction);
    return { hash: response.hash, successful: response.successful };
  } catch (cause) {
    throw new OnboardingTransactionError('Could not submit the onboarding transaction. Try again.', {
      cause,
    });
  }
}
