import { Horizon } from '@stellar/stellar-sdk';
import { attachEd25519Signature } from '@/lib/stellar-signature';

export class DepositSubmissionError extends Error {}

const server = new Horizon.Server('https://horizon.stellar.org');

/**
 * Issue #16, gap #2: the DFNS-backed counterpart to
 * `wallet-kit.ts`'s `signDepositTransaction`. A DFNS-onboarded
 * depositor's signing key lives in DFNS's MPC infrastructure, not a
 * StellarWalletsKit-compatible wallet extension, so the deposit
 * transaction's signature is attached here from a raw ed25519
 * signature already produced by DFNS, then submitted, the same
 * decorated-signature construction `onboarding-transaction.ts`
 * already uses for the sponsored onboarding transaction (`Uint8Array`
 * throughout, `xdr.DecoratedSignature`'s decoder rejects a Node
 * `Buffer`).
 */
export async function attachDepositorSignatureAndSubmit(
  unsignedXdr: string,
  depositorPublicKey: string,
  signature: Uint8Array
): Promise<{ hash: string; successful: boolean }> {
  const transaction = attachEd25519Signature(unsignedXdr, depositorPublicKey, signature);

  try {
    const response = await server.submitTransaction(transaction);
    return { hash: response.hash, successful: response.successful };
  } catch (cause) {
    throw new DepositSubmissionError('Could not submit the deposit transaction. Try again.', {
      cause,
    });
  }
}
