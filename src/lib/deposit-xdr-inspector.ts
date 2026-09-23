import { Networks, TransactionBuilder, inspectAuthEntry } from '@stellar/stellar-sdk';
import type { ValidatedTransactionXDR } from '@/lib/types';

export class DepositXDRInspectionError extends Error {}

export interface DepositTransactionInfo {
  signatureExpirationLedger: number;
  feeStroops: string;
  transactionHashHex: string;
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
 */
export function inspectDepositTransaction(
  xdr: ValidatedTransactionXDR
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

  const expirations = invokeOp.auth
    .map((entry) => inspectAuthEntry(entry).signatureExpirationLedger)
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
