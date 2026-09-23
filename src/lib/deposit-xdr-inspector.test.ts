import { describe, expect, it } from 'vitest';
import { Account, Address, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { inspectDepositTransaction, DepositXDRInspectionError } from './deposit-xdr-inspector';
import { validateTransactionXDR } from './validation';

function buildAuthEntry(depositorAddress: string, signatureExpirationLedger: number) {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(depositorAddress).toScAddress(),
        nonce: BigInt(1),
        signatureExpirationLedger,
        signature: xdr.ScVal.scvVoid(),
      })
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(depositorAddress).toScAddress(),
          functionName: 'deposit',
          args: [],
        })
      ),
      subInvocations: [],
    }),
  });
}

function buildTestDepositXDR(signatureExpirationLedger: number | null): ReturnType<typeof validateTransactionXDR> {
  const source = Keypair.random();
  const depositor = Keypair.random().publicKey();
  const vault = Address.contract(new Uint8Array(32)).toString();
  const account = new Account(source.publicKey(), '1');

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  }).addOperation(
    Operation.invokeContractFunction({
      contract: vault,
      function: 'deposit',
      args: [],
      auth: signatureExpirationLedger === null ? [] : [buildAuthEntry(depositor, signatureExpirationLedger)],
    })
  );
  builder.setTimeout(30);

  return validateTransactionXDR(builder.build().toXDR());
}

describe('inspectDepositTransaction', () => {
  it('extracts the real signatureExpirationLedger and fee already encoded in the transaction', () => {
    const xdrString = buildTestDepositXDR(123456);

    const result = inspectDepositTransaction(xdrString);

    expect(result.signatureExpirationLedger).toBe(123456);
    expect(result.feeStroops).toBe(BASE_FEE);
  });

  it('refuses to time a transaction with no authorization entries, never guessing a window', () => {
    const xdrString = buildTestDepositXDR(null);

    expect(() => inspectDepositTransaction(xdrString)).toThrow(DepositXDRInspectionError);
  });
});
