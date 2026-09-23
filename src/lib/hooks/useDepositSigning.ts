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
import { signAndSubmitDepositWithDfns } from '@/lib/dfns-deposit-signing';

export type DepositSigningStatus =
  | 'idle'
  | 'building'
  | 'insufficient-fee'
  | 'ready-to-sign'
  | 'signing'
  | 'disconnected'
  | 'submitting'
  | 'submitted'
  | 'confirming on-chain'
  | 'completed'
  | 'reverted'
  | 'failed';

export interface DepositSigningParams {
  depositorAddress: string;
  amountInSmallestUnits: string;
  slippageBps?: number;
  /**
   * Issue #16, gap #2: which signing capability actually holds
   * `depositorAddress`'s key, StellarWalletsKit (the default, every
   * caller before this) or a DFNS-onboarded passkey wallet. Determines
   * which signing path `sign()` takes; `dfnsWalletId` is required
   * when this is `'dfns'`.
   */
  signingSource?: 'wallet-kit' | 'dfns';
  dfnsWalletId?: string;
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
  dfTokens: number | null;
  start: (params: DepositSigningParams) => Promise<void>;
  sign: () => Promise<void>;
}

const RESYNC_INTERVAL_MS = 20000;
const CONFIRMATION_POLL_INTERVAL_MS = 5000;
const DEFAULT_SLIPPAGE_BPS = 100;

function computeMinimumGuaranteed(amountInSmallestUnits: string, slippageBps: number): string {
  const amount = BigInt(amountInSmallestUnits);
  const remainingBps = BigInt(10000 - slippageBps);
  return ((amount * remainingBps) / BigInt(10000)).toString();
}

interface VaultBalance {
  dfTokens: number;
  underlyingBalance: number[];
}

async function fetchVaultBalance(
  vaultAddress: string,
  depositorAddress: string
): Promise<VaultBalance> {
  const params = new URLSearchParams({ vaultAddress, depositorAddress });
  const response = await fetch(`/api/deposit/balance?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Could not read your vault balance.');
  }
  return payload as VaultBalance;
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
  const [dfTokens, setDfTokens] = useState<number | null>(null);

  const paramsRef = useRef<DepositSigningParams | null>(null);
  const xdrRef = useRef<ValidatedTransactionXDR | null>(null);
  const transactionHashHexRef = useRef<string | null>(null);
  const expirationLedgerRef = useRef<number | null>(null);
  const baselineDfTokensRef = useRef<number | null>(null);
  const vaultAddressRef = useRef<string | null>(null);
  const confirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(
    () => () => {
      unmountedRef.current = true;
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    },
    []
  );

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
    vaultAddressRef.current = responseVaultAddress;
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
      // Security review finding: verified against the requested vault
      // and this depositor's own address before ever reaching the
      // signature prompt, not just structurally validated.
      const info = inspectDepositTransaction(xdr, {
        vaultAddress: responseVaultAddress,
        depositorAddress: params.depositorAddress,
      });
      signatureExpirationLedger = info.signatureExpirationLedger;
      feeStroops = info.feeStroops;
      transactionHashHexRef.current = info.transactionHashHex;
    } catch (cause) {
      setStatus('failed');
      setErrorMessage(
        cause instanceof Error ? cause.message : 'Could not read the deposit transaction.'
      );
      return;
    }

    let timing;
    let xlmBalance;
    let baselineBalance: VaultBalance;
    try {
      [timing, xlmBalance, baselineBalance] = await Promise.all([
        getLedgerTiming(),
        getAssetBalance(params.depositorAddress, { code: 'XLM' }),
        fetchVaultBalance(responseVaultAddress, params.depositorAddress),
      ]);
    } catch (cause) {
      setStatus('failed');
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not check your account.');
      return;
    }
    // Story 1.11, AC #2: confirmation is judged against the depositor's
    // real pre-deposit dfToken balance, an increase over this baseline,
    // never just "any balance present" (the same discipline Story 1.8
    // already applied to origin-chain settlement detection).
    baselineDfTokensRef.current = baselineBalance.dfTokens;

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

  // Story 1.11, AC #1/#2: `submitted` and `confirming on-chain` are
  // rendered as two distinct, visibly labeled states, never collapsed
  // into one; confirmation is judged against the real, independently
  // queryable dfToken balance, and its outcome is folded into the
  // correlation record Story 1.8 already wrote (AC #4). Driven
  // directly from `sign`, not a `useEffect` keyed on `status`: this
  // function's own `setStatus('confirming on-chain')` would otherwise
  // immediately retrigger and tear down such an effect before its
  // interval ever got to fire a second time.
  const confirmDeposit = useCallback((vault: string, depositorAddress: string) => {
    setStatus('confirming on-chain');
    const baseline = baselineDfTokensRef.current ?? 0;

    const poll = async () => {
      try {
        const balance = await fetchVaultBalance(vault, depositorAddress);
        if (unmountedRef.current) return;
        if (balance.dfTokens > baseline) {
          setDfTokens(balance.dfTokens);
          setStatus('completed');
          fetch('/api/correlation', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stellarAddress: depositorAddress,
              destinationVault: vault,
              depositStatus: 'completed',
              depositConfirmedAt: new Date().toISOString(),
            }),
          }).catch(() => {
            // Rule #9: a failed cache update is never treated as a
            // failed deposit, the funds are already confirmed earning.
          });
          return;
        }
      } catch {
        // A transient poll failure doesn't fail the deposit, the next
        // poll tries again rather than giving up on a real confirmation.
      }
      if (!unmountedRef.current) {
        confirmationTimeoutRef.current = setTimeout(poll, CONFIRMATION_POLL_INTERVAL_MS);
      }
    };

    poll();
  }, []);

  const signViaDfns = useCallback(
    async (xdr: ValidatedTransactionXDR, params: DepositSigningParams) => {
      const hashHex = transactionHashHexRef.current;
      if (!params.dfnsWalletId || !hashHex) {
        setStatus('failed');
        setErrorMessage('Missing signing wallet. Try again.');
        return;
      }
      try {
        const submitted = await signAndSubmitDepositWithDfns(
          xdr,
          hashHex,
          params.dfnsWalletId,
          params.depositorAddress
        );
        setTxHash(submitted.hash);
        if (!submitted.successful) {
          setStatus('reverted');
          setErrorMessage(
            'The deposit was rejected on-chain, for example if the price moved past your slippage tolerance. You can try again.'
          );
          return;
        }
        setStatus('submitted');
        if (vaultAddressRef.current) {
          confirmDeposit(vaultAddressRef.current, params.depositorAddress);
        }
      } catch (cause) {
        setStatus('failed');
        setErrorMessage(cause instanceof Error ? cause.message : 'Signature failed.');
      }
    },
    [confirmDeposit]
  );

  const signViaWalletKit = useCallback(
    async (xdr: ValidatedTransactionXDR, params: DepositSigningParams) => {
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
        setTxHash(submitted.hash);
        if (!submitted.successful) {
          // Story 1.11, AC #3: the transaction reached a ledger but its
          // own invocation failed on-chain (for example, slippage
          // exceeded), a distinct outcome from a submission-level
          // failure, surfaced as its own explicit state, never a
          // collapsed generic "failed".
          setStatus('reverted');
          setErrorMessage(
            'The deposit was rejected on-chain, for example if the price moved past your slippage tolerance. You can try again.'
          );
          return;
        }
        setStatus('submitted');
        if (vaultAddressRef.current) {
          confirmDeposit(vaultAddressRef.current, params.depositorAddress);
        }
      } catch (cause) {
        setStatus('failed');
        setErrorMessage(cause instanceof Error ? cause.message : 'Could not submit the deposit.');
      }
    },
    [confirmDeposit]
  );

  // Issue #16, gap #2: dispatches by `signingSource` rather than
  // assuming every depositor holds a StellarWalletsKit-compatible
  // wallet. The DFNS path has no separate client-side submission step
  // (`/api/deposit/sign-complete` attaches and submits together
  // server-side, the same shape the onboarding transaction's own
  // sign-complete route already uses), so it never passes through
  // `submitting`, unlike the wallet-kit path's genuine two-phase
  // sign-then-submit; documented, not hidden.
  const sign = useCallback(async () => {
    const xdr = xdrRef.current;
    const params = paramsRef.current;
    if (!xdr || !params) return;

    setStatus('signing');
    setErrorMessage(null);

    if (params.signingSource === 'dfns') {
      await signViaDfns(xdr, params);
    } else {
      await signViaWalletKit(xdr, params);
    }
  }, [signViaDfns, signViaWalletKit]);

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
    dfTokens,
    start: buildAndCheck,
    sign,
  };
}
