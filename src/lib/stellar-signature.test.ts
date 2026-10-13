import { describe, expect, it } from 'vitest';
import {
  Account,
  Asset,
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { attachEd25519Signature, StellarSignatureError } from './stellar-signature';

function buildUnsignedXdr(sourceKeypair: Keypair): string {
  const account = new Account(sourceKeypair.publicKey(), '1');
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  }).addOperation(
    Operation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: '1',
    })
  );
  builder.setTimeout(30);
  return builder.build().toXDR();
}

describe('attachEd25519Signature (Issue #59)', () => {
  it('attaches a signature that actually verifies against the signer, the exact check Horizon itself performs', () => {
    const signer = Keypair.random();
    const xdr = buildUnsignedXdr(signer);
    const unsigned = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC);
    if (!('hash' in unsigned)) throw new Error('expected a plain Transaction');
    const realSignature = signer.sign(unsigned.hash());

    const attached = attachEd25519Signature(xdr, signer.publicKey(), realSignature);

    expect(attached.signatures).toHaveLength(1);
    expect(signer.verify(attached.hash(), attached.signatures[0].signature)).toBe(true);
  });

  it('computes the signature hint as the last 4 bytes of the signer\'s raw public key', () => {
    const signer = Keypair.random();
    const xdr = buildUnsignedXdr(signer);
    const fakeSignature = new Uint8Array(64);

    const attached = attachEd25519Signature(xdr, signer.publicKey(), fakeSignature);

    const expectedHint = signer.rawPublicKey().subarray(-4);
    expect(new Uint8Array(attached.signatures[0].hint.value)).toEqual(expectedHint);
  });

  it('rejects a fee-bump transaction rather than silently mis-handling it', () => {
    const inner = Keypair.random();
    const feeBumper = Keypair.random();
    const innerXdr = buildUnsignedXdr(inner);
    const innerTransaction = TransactionBuilder.fromXDR(innerXdr, Networks.PUBLIC);
    if (innerTransaction instanceof FeeBumpTransaction) {
      throw new Error('expected a plain Transaction');
    }
    const feeBumpXdr = TransactionBuilder.buildFeeBumpTransaction(
      feeBumper,
      String(Number(BASE_FEE) * 2),
      innerTransaction,
      Networks.PUBLIC
    ).toXDR();

    expect(() => attachEd25519Signature(feeBumpXdr, inner.publicKey(), new Uint8Array(64))).toThrow(
      StellarSignatureError
    );
  });
});
