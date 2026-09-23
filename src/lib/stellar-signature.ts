import {
  FeeBumpTransaction,
  Keypair,
  Transaction,
  TransactionBuilder,
  Networks,
  xdr,
} from '@stellar/stellar-sdk';

export class StellarSignatureError extends Error {}

/**
 * Attaches a raw ed25519 signature (already produced elsewhere, for
 * example by DFNS's MPC signing over the transaction's own hash) to a
 * transaction, ready to submit. Shared between the onboarding
 * transaction (Story 2.2) and deposit transaction (Issue #16) signing
 * paths, both of which needed this identical decorated-signature
 * construction.
 *
 * `xdr.DecoratedSignature`'s decoder rejects a Node `Buffer` even
 * though `Buffer` is itself a `Uint8Array` subclass, a real strictness
 * caught by `onboarding-transaction.test.ts`'s round-trip test, not
 * assumed away here either.
 */
export function attachEd25519Signature(
  xdrString: string,
  publicKey: string,
  signature: Uint8Array
): Transaction {
  const transaction = TransactionBuilder.fromXDR(xdrString, Networks.PUBLIC);
  // `instanceof`, not an `'operations' in transaction` property check:
  // FeeBumpTransaction also exposes an `operations` getter (delegating
  // to its inner transaction), so that check never actually excludes a
  // fee-bump transaction, a latent, pre-existing narrowing gap noticed
  // while writing this function, not itself a live bug since this
  // project never builds fee-bump transactions, but worth guarding
  // correctly in new code.
  if (transaction instanceof FeeBumpTransaction) {
    throw new StellarSignatureError('Unexpected fee-bump transaction.');
  }

  const hint = new Uint8Array(Keypair.fromPublicKey(publicKey).rawPublicKey().subarray(-4));
  const decorated = new xdr.DecoratedSignature({
    hint,
    signature: new Uint8Array(signature),
  });
  transaction.signatures.push(decorated);
  return transaction;
}
