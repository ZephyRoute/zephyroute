'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { validateTransactionXDR } from '@/lib/validation';
import type { ValidatedTransactionXDR } from '@/lib/types';
import { inspectDepositTransaction } from '@/lib/deposit-xdr-inspector';
import {
  getLedgerTiming,
  getAssetBalance,
  submitDepositTransaction,
} from '@/lib/horizon';
import { signDepositTransaction, DepositSigningError } from '@/lib/wallet-kit';

export type DepositSigningStatus =
  | 'idle'
  | 'building'
  | 'insufficient-fee'
  | 'ready-to-sign'
  | 'signing'
  | 'disconnected'
  | 'submitting'
  | 'submitted'
  | 'failed';

export interface DepositSigningParams {
  depositorAddress: string;
  amountInSmallestUnits: string;
  slippageBps?: number;
}

export interface UseDepositSigningResult {
  status: DepositSigningStatus;
  errorMessage: string | null;
  vaultAddress: string | null;
  amountInSmallestUnits: string | null;
  minimumGuaranteedInSmallestUnits: string | null;
  secondsRemaining: number | null;
  requiredFeeXLM: string | null;
  availableXLM: string | null;
  rebuildAnnouncement: string | null;
  txHash: string | null;
  start: (params: DepositSigningParams) => Promise<void>;
  sign: () => Promise<void>;
}

const RESYNC_INTERVAL_MS = 20000;
const DEFAULT_SLIPPAGE_BPS = 100;

function computeMinimumGuaranteed(amountInSmallestUnits: string, slippageBps: number): string {
  const amount = BigInt(amountInSmallestUnits);
  const remainingBps = BigInt(10000 - slippageBps);
  return ((amount * remainingBps) / BigInt(10000)).toString();
}

/**
 * Story 1.10: presents the DeFindex deposit for signature within its
 * real, server-issued authorization window (AC #1), auto-rebuilds on
 * expiry (AC #2), reports a wallet disconnect explicitly rather than
 * assuming success (AC #3), and refuses to reach a signature prompt at
 * all when the depositor can't cover the network fee (AC #4).
 */
export function useDepositSigning(): UseDepositSigningResult {
  const [status, setStatus] = useState<DepositSigningStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [minimumGuaranteed, setMinimumGuaranteed] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [requiredFeeXLM, setRequiredFeeXLM] = useState<string | null>(null);
  const [availableXLM, setAvailableXLM] = useState<string | null>(null);
  const [rebuildAnnouncement, setRebuildAnnouncement] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const paramsRef = useRef<DepositSigningParams | null>(null);
  const xdrRef = useRef<ValidatedTransactionXDR | null>(null);
  const expirationLedgerRef = useRef<number | null>(null);

  const buildAndCheck = useCallback(async (params: DepositSigningParams) => {
    setStatus('building');
    setErrorMessage(null);
    paramsRef.current = params;

    let xdr: ValidatedTransactionXDR;
    let responseVaultAddress: string;
    try {
      const response = await fetch('/api/deposit/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus('failed');
        setErrorMessage(payload?.error?.message ?? 'Could not prepare the deposit. Try again.');
        return;
      }
      // AC #3/#4: re-validated on this side of the wire too, never
      // trusted blindly just because the route already checked it.
      xdr = validateTransactionXDR(payload.xdr);
      responseVaultAddress = payload.vaultAddress;
    } catch {
      setStatus('failed');
      setErrorMessage('Could not reach the deposit service. Try again.');
      return;
    }

    xdrRef.current = xdr;
    setVaultAddress(responseVaultAddress);
    setAmount(params.amountInSmallestUnits);
    setMinimumGuaranteed(
      computeMinimumGuaranteed(
        params.amountInSmallestUnits,
        params.slippageBps ?? DEFAULT_SLIPPAGE_BPS
      )
    );

    let signatureExpirationLedger: number;
    let feeStroops: string;
    try {
      const info = inspectDepositTransaction(xdr);
      signatureExpirationLedger = info.signatureExpirationLedger;
      feeStroops = info.feeStroops;
    } catch (cause) {
      setStatus('failed');
      setErrorMessage(
        cause instanceof Error ? cause.message : 'Could not read the deposit transaction.'
      );
      return;
    }

    let timing;
    let xlmBalance;
    try {
      [timing, xlmBalance] = await Promise.all([
        getLedgerTiming(),
        getAssetBalance(params.depositorAddress, { code: 'XLM' }),
      ]);
    } catch (cause) {
      setStatus('failed');
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not check your account.');
      return;
    }

    const feeXLM = (Number(feeStroops) / 1e7).toString();
    const balanceXLM = xlmBalance?.balance ?? '0';
    setRequiredFeeXLM(feeXLM);
    setAvailableXLM(balanceXLM);

    // AC #4: checked before ever reaching a signature prompt, never
    // discovered only after the user has already signed.
    if (Number(balanceXLM) < Number(feeXLM)) {
      setStatus('insufficient-fee');
      return;
    }

    expirationLedgerRef.current = signatureExpirationLedger;
    setExpiresAtMs(
      timing.currentLedgerCloseMs +
        (signatureExpirationLedger - timing.currentLedgerSeq) * timing.ledgerCloseIntervalMs
    );
    setStatus('ready-to-sign');
  }, []);

  // AC #1/#2: the countdown ticks locally between resyncs, but its
  // anchor is re-derived from the network's real current ledger every
  // RESYNC_INTERVAL_MS, and an actually-expired window triggers an
  // automatic rebuild rather than a dead countdown or a signable-but-
  // rejected transaction.
  useEffect(() => {
    if (status !== 'ready-to-sign' || expiresAtMs === null) return;

    const tick = () => {
      setSecondsRemaining(Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000)));
    };
    tick();
    const tickId = setInterval(tick, 1000);

    const resync = async () => {
      const currentParams = paramsRef.current;
      const currentExpirationLedger = expirationLedgerRef.current;
      if (!currentParams || currentExpirationLedger === null) return;
      try {
        const timing = await getLedgerTiming();
        if (timing.currentLedgerSeq >= currentExpirationLedger) {
          setRebuildAnnouncement(
            'Your signature window expired. Preparing a new deposit transaction now.'
          );
          await buildAndCheck(currentParams);
          setRebuildAnnouncement('A new deposit transaction is ready to sign.');
        } else {
          setExpiresAtMs(
            timing.currentLedgerCloseMs +
              (currentExpirationLedger - timing.currentLedgerSeq) * timing.ledgerCloseIntervalMs
          );
        }
      } catch {
        // A resync failure doesn't invalidate the current countdown,
        // the next resync attempt tries again rather than failing the
        // whole flow over a transient Horizon hiccup.
      }
    };
    const resyncId = setInterval(resync, RESYNC_INTERVAL_MS);

    return () => {
      clearInterval(tickId);
      clearInterval(resyncId);
    };
  }, [status, expiresAtMs, buildAndCheck]);

  const sign = useCallback(async () => {
    const xdr = xdrRef.current;
    const params = paramsRef.current;
    if (!xdr || !params) return;

    setStatus('signing');
    setErrorMessage(null);

    let signedXdr: string;
    try {
      signedXdr = await signDepositTransaction(xdr, params.depositorAddress);
    } catch (cause) {
      if (cause instanceof DepositSigningError && cause.reason === 'disconnected') {
        setStatus('disconnected');
      } else {
        setStatus('failed');
      }
      setErrorMessage(cause instanceof Error ? cause.message : 'Signature failed.');
      return;
    }

    setStatus('submitting');
    try {
      const submitted = await submitDepositTransaction(signedXdr);
      if (!submitted.successful) {
        setStatus('failed');
        setErrorMessage('The deposit transaction was rejected by the network.');
        return;
      }
      setTxHash(submitted.hash);
      setStatus('submitted');
    } catch (cause) {
      setStatus('failed');
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not submit the deposit.');
    }
  }, []);

  return {
    status,
    errorMessage,
    vaultAddress,
    amountInSmallestUnits: amount,
    minimumGuaranteedInSmallestUnits: minimumGuaranteed,
    secondsRemaining,
    requiredFeeXLM,
    availableXLM,
    rebuildAnnouncement,
    txHash,
    start: buildAndCheck,
    sign,
  };
}
