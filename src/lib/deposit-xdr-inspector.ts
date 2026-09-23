import { Address, Networks, TransactionBuilder, inspectAuthEntry } from '@stellar/stellar-sdk';
import type { ValidatedTransactionXDR } from '@/lib/types';

export class DepositXDRInspectionError extends Error {}

export interface DepositTransactionInfo {
  signatureExpirationLedger: number;
  feeStroops: string;
  transactionHashHex: string;
}

export interface ExpectedDepositTarget {
  vaultAddress: string;
  depositorAddress: string;
}

/**
 * No `Buffer` here, this module runs client-side (imported into
 * `useDepositSigning.ts`, a `'use client'` hook), and this project's
 * Next.js bundling doesn't polyfill it in the browser.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Story 1.10, AC #1: the signature window's expiry and the exact
 * network fee both live inside the transaction DeFindex already built
 * and this project already validated (Story 1.9), never re-derived or
 * guessed from architecture.md's documented 12-60 ledger range.
 *
 * Security review finding (2026-09-22): before this, nothing checked
 * that the XDR actually invoked the vault this session requested, or
 * required this depositor's own authorization, before it ever reached
 * the signature prompt, `validateTransactionXDR` only confirms the
 * string looks like a Soroban envelope, never its contents. `expected`
 * closes that gap for the two things checkable without DeFindex's own
 * contract ABI (its exact argument order/types are not confirmed from
 * any source this project could verify, the same boundary
 * `useDepositSigning.ts`'s own "minimum guaranteed" comment already
 * drew for amount decoding, not attempted here either): the invoked
 * contract address (from the operation's own `invokeContract` wrapper,
 * ABI-independent) and the authorizing address on at least one
 * Soroban authorization entry (`inspectAuthEntry`'s own `address`
 * field, part of the authorization framework itself, not the vault's
 * specific ABI). Deliberately does not attempt to verify the deposit
 * amount for that same reason.
 */
export function inspectDepositTransaction(
  xdr: ValidatedTransactionXDR,
  expected: ExpectedDepositTarget
): DepositTransactionInfo {
  const parsed = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC);
  if (!('operations' in parsed)) {
    throw new DepositXDRInspectionError('Unexpected fee-bump deposit transaction.');
  }

  const invokeOp = parsed.operations.find((op) => op.type === 'invokeHostFunction');
  if (!invokeOp || !invokeOp.auth || invokeOp.auth.length === 0) {
    throw new DepositXDRInspectionError(
      'The deposit transaction has no authorization entries to time.'
    );
  }

  if (invokeOp.func.type !== 'hostFunctionTypeInvokeContract') {
    throw new DepositXDRInspectionError(
      'The deposit transaction does not invoke a contract function.'
    );
  }
  const invoked = invokeOp.func.invokeContract;
  const invokedContractAddress = Address.fromScAddress(invoked.contractAddress).toString();
  if (invokedContractAddress !== expected.vaultAddress) {
    throw new DepositXDRInspectionError(
      'The deposit transaction targets a different vault than the one this session requested.'
    );
  }
  if (invoked.functionName.toString() !== 'deposit') {
    throw new DepositXDRInspectionError(
      'The deposit transaction does not call the expected deposit function.'
    );
  }

  const authInfos = invokeOp.auth.map((entry) => inspectAuthEntry(entry));
  const authorizesDepositor = authInfos.some((info) => info.address === expected.depositorAddress);
  if (!authorizesDepositor) {
    throw new DepositXDRInspectionError(
      'The deposit transaction does not require your own authorization.'
    );
  }

  const expirations = authInfos
    .map((info) => info.signatureExpirationLedger)
    .filter((ledger): ledger is number => ledger !== null);

  if (expirations.length === 0) {
    throw new DepositXDRInspectionError(
      'The deposit transaction has no address-based authorization to time.'
    );
  }

  return {
    signatureExpirationLedger: Math.min(...expirations),
    feeStroops: parsed.fee,
    transactionHashHex: bytesToHex(parsed.hash()),
  };
}
