import { describe, expect, it } from 'vitest';
import { Account, Address, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { inspectDepositTransaction, DepositXDRInspectionError } from './deposit-xdr-inspector';
import { validateTransactionXDR } from './validation';

function buildAuthEntry(authorizingAddress: string, signatureExpirationLedger: number) {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(authorizingAddress).toScAddress(),
        nonce: BigInt(1),
        signatureExpirationLedger,
        signature: xdr.ScVal.scvVoid(),
      })
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(authorizingAddress).toScAddress(),
          functionName: 'deposit',
          args: [],
        })
      ),
      subInvocations: [],
    }),
  });
}

interface TestDepositTransaction {
  xdr: ReturnType<typeof validateTransactionXDR>;
  vault: string;
  depositor: string;
}

function buildTestDepositXDR(options: {
  signatureExpirationLedger: number | null;
  functionName?: string;
  authorizingAddress?: string;
}): TestDepositTransaction {
  const source = Keypair.random();
  const depositor = Keypair.random().publicKey();
  const vault = Address.contract(new Uint8Array(32)).toString();
  const account = new Account(source.publicKey(), '1');
  const { signatureExpirationLedger, functionName = 'deposit', authorizingAddress = depositor } = options;

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  }).addOperation(
    Operation.invokeContractFunction({
      contract: vault,
      function: functionName,
      args: [],
      auth:
        signatureExpirationLedger === null
          ? []
          : [buildAuthEntry(authorizingAddress, signatureExpirationLedger)],
    })
  );
  builder.setTimeout(30);

  return { xdr: validateTransactionXDR(builder.build().toXDR()), vault, depositor };
}

describe('inspectDepositTransaction', () => {
  it('extracts the real signatureExpirationLedger and fee already encoded in the transaction', () => {
    const { xdr: xdrString, vault, depositor } = buildTestDepositXDR({ signatureExpirationLedger: 123456 });

    const result = inspectDepositTransaction(xdrString, {
      vaultAddress: vault,
      depositorAddress: depositor,
    });

    expect(result.signatureExpirationLedger).toBe(123456);
    expect(result.feeStroops).toBe(BASE_FEE);
  });

  it('refuses to time a transaction with no authorization entries, never guessing a window', () => {
    const { xdr: xdrString, vault, depositor } = buildTestDepositXDR({ signatureExpirationLedger: null });

    expect(() =>
      inspectDepositTransaction(xdrString, { vaultAddress: vault, depositorAddress: depositor })
    ).toThrow(DepositXDRInspectionError);
  });

  describe('content-level review before signing (security review finding)', () => {
    it('refuses a transaction invoking a different contract than the requested vault', () => {
      const { xdr: xdrString, depositor } = buildTestDepositXDR({ signatureExpirationLedger: 100 });
      const someOtherContract = Address.contract(new Uint8Array(32).fill(1)).toString();

      expect(() =>
        inspectDepositTransaction(xdrString, {
          vaultAddress: someOtherContract,
          depositorAddress: depositor,
        })
      ).toThrow(DepositXDRInspectionError);
    });

    it('refuses a transaction whose function is not "deposit"', () => {
      const { xdr: xdrString, vault, depositor } = buildTestDepositXDR({
        signatureExpirationLedger: 100,
        functionName: 'withdraw',
      });

      expect(() =>
        inspectDepositTransaction(xdrString, { vaultAddress: vault, depositorAddress: depositor })
      ).toThrow(DepositXDRInspectionError);
    });

    it('refuses a transaction that does not require this depositor\'s own authorization', () => {
      const someoneElse = Keypair.random().publicKey();
      const { xdr: xdrString, vault, depositor } = buildTestDepositXDR({
        signatureExpirationLedger: 100,
        authorizingAddress: someoneElse,
      });

      expect(() =>
        inspectDepositTransaction(xdrString, { vaultAddress: vault, depositorAddress: depositor })
      ).toThrow(DepositXDRInspectionError);
    });

    it('accepts a transaction that matches the requested vault, function, and depositor exactly', () => {
      const { xdr: xdrString, vault, depositor } = buildTestDepositXDR({ signatureExpirationLedger: 100 });

      expect(() =>
        inspectDepositTransaction(xdrString, { vaultAddress: vault, depositorAddress: depositor })
      ).not.toThrow();
    });
  });
});
