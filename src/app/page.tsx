'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/features/TrustBadge';
import { QuoteDisplay } from '@/components/features/QuoteDisplay';
import { StepTracker } from '@/components/features/StepTracker';
import { DepositSigningPanel } from '@/components/features/DepositSigningPanel';
import { useWallet } from '@/lib/hooks/useWallet';
import { useQuote } from '@/lib/hooks/useQuote';
import { useTrustlineCheck } from '@/lib/hooks/useTrustlineCheck';
import { useOriginSwap } from '@/lib/hooks/useOriginSwap';
import { useSettlementStatus } from '@/lib/hooks/useSettlementStatus';
import { useDepositSigning } from '@/lib/hooks/useDepositSigning';
import { getAssetBalance } from '@/lib/horizon';
import { SUPPORTED_ROUTES } from '@/lib/routes';
import type { FlowStage } from '@/lib/types';

export default function Home() {
  const { address, status: walletStatus, errorMessage: walletError, connect } = useWallet();
  const { quote, status: quoteStatus, errorMessage: quoteError, requestQuoteFor } = useQuote();
  const trustline = useTrustlineCheck();
  const originSwap = useOriginSwap();
  const depositSigning = useDepositSigning();
  const [routeIndex, setRouteIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [baselineBalance, setBaselineBalance] = useState<string | null>(null);
  const correlationWrittenRef = useRef(false);
  const depositStartedRef = useRef(false);

  const route = SUPPORTED_ROUTES[routeIndex];

  const settlement = useSettlementStatus({
    accountId: address ?? '',
    asset: route.stellarAsset,
    baselineBalance: baselineBalance ?? '',
    enabled: Boolean(address && baselineBalance !== null && originSwap.status === 'submitted'),
  });

  // Correlation record write, the moment settlement is first confirmed
  // (Story 1.8's own AC), never repeated once already written. Goes
  // through /api/correlation rather than lib/validation.ts's
  // writeCorrelationRecord directly, that carries the Upstash Redis
  // REST token, a secret that must never reach client code (Issue #7).
  useEffect(() => {
    if (!settlement.settled || correlationWrittenRef.current || !address || !quote) return;
    correlationWrittenRef.current = true;
    fetch('/api/correlation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stellarAddress: address,
        originChainAsset: route.originAsset,
        settledAmount: quote.quote.amountOut,
        settledAt: settlement.settledAt ?? new Date().toISOString(),
        integratorId: 'zephyroute',
        correlationId: quote.correlationId,
      }),
    }).catch(() => {
      // Rule #9: a failed cache write is never treated as a failed
      // settlement, the user's funds already arrived regardless.
    });
  }, [settlement.settled, settlement.settledAt, address, quote, route.originAsset]);

  // Story 1.10: the deposit XDR is built on-demand the moment
  // settlement is confirmed, never speculatively ahead of it
  // (architecture.md's own timing constraint), and only once.
  useEffect(() => {
    if (!settlement.settled || depositStartedRef.current || !address || !quote) return;
    depositStartedRef.current = true;
    depositSigning.start({
      depositorAddress: address,
      amountInSmallestUnits: quote.quote.amountOut,
      slippageBps: 100,
    });
  }, [settlement.settled, address, quote, depositSigning]);

  const flowStage: FlowStage = !quote
    ? 'quoted'
    : originSwap.status === 'idle' || originSwap.status === 'connecting' || originSwap.status === 'signing'
      ? 'quoted'
      : !settlement.settled
        ? 'submitted'
        : depositSigning.status === 'completed'
          ? 'earning'
          : depositSigning.status === 'idle'
            ? 'settled'
            : 'depositing';

  const handleRequestQuote = async () => {
    if (!address || !amount) return;

    const present = await trustline.check(address, route.stellarAsset);
    if (!present) return;

    // Capture the pre-settlement balance so arrival can be detected as
    // an increase, not merely "a balance is present" (FR4).
    const current = await getAssetBalance(address, route.stellarAsset);
    setBaselineBalance(current?.balance ?? '0');

    requestQuoteFor({
      originAsset: route.originAsset,
      destinationAsset: route.destinationAsset,
      amount,
      recipient: address,
      refundTo: address,
      slippageToleranceBps: 100,
      deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  };

  const handleSignOriginSwap = async () => {
    if (!quote?.quote.depositAddress) return;
    try {
      await originSwap.signAndSubmit(route, quote.quote.depositAddress, quote.quote.amountIn);
    } catch {
      // surfaced via originSwap.errorMessage below, never a silent failure
    }
  };

  return (
    <main>
      <TrustBadge />
      <h1>Zephyroute</h1>

      {walletStatus !== 'connected' && (
        <Button onClick={connect} disabled={walletStatus === 'connecting'}>
          {walletStatus === 'connecting' ? 'Connecting…' : 'Connect wallet'}
        </Button>
      )}

      {walletStatus === 'connected' && address && <p role="status">Connected: {address}</p>}

      {walletStatus === 'failed' && walletError && <p role="alert">{walletError}</p>}

      {walletStatus === 'connected' && (
        <div>
          {quoteStatus === 'ready' && (
            <StepTracker
              stage={flowStage}
              failed={
                originSwap.status === 'failed' ||
                depositSigning.status === 'failed' ||
                depositSigning.status === 'reverted'
              }
              timestamps={settlement.settledAt ? { settled: settlement.settledAt } : undefined}
            />
          )}

          <label htmlFor="route-select">Route</label>
          <select
            id="route-select"
            value={routeIndex}
            onChange={(event) => setRouteIndex(Number(event.target.value))}
            disabled={quoteStatus === 'ready'}
          >
            {SUPPORTED_ROUTES.map((r, index) => (
              <option key={r.label} value={index}>
                {r.label}
              </option>
            ))}
          </select>

          <label htmlFor="amount-input">Amount</label>
          <input
            id="amount-input"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount in smallest units"
            disabled={quoteStatus === 'ready'}
          />

          {quoteStatus !== 'ready' && (
            <Button
              onClick={handleRequestQuote}
              disabled={quoteStatus === 'loading' || trustline.status === 'checking' || !amount}
            >
              {trustline.status === 'checking'
                ? 'Checking your account…'
                : quoteStatus === 'loading'
                  ? 'Getting quote…'
                  : 'Get quote'}
            </Button>
          )}

          {trustline.status === 'missing' && (
            <p role="alert">
              Your Stellar account doesn&apos;t hold the trustline for this destination asset
              yet. Onboarding for new accounts isn&apos;t available in this build yet (Epic 2).
            </p>
          )}

          {trustline.status === 'failed' && trustline.errorMessage && (
            <p role="alert">{trustline.errorMessage}</p>
          )}

          {(quoteStatus === 'rejected' || quoteStatus === 'failed') && quoteError && (
            <p role="alert">{quoteError}</p>
          )}

          {quoteStatus === 'ready' && quote && (
            <>
              <QuoteDisplay quote={quote} />

              {originSwap.status === 'idle' && (
                <Button onClick={handleSignOriginSwap}>Sign origin-chain swap</Button>
              )}

              {(originSwap.status === 'connecting' || originSwap.status === 'signing') && (
                <p role="status">
                  {originSwap.status === 'connecting' ? 'Connecting your EVM wallet…' : 'Signing…'}
                </p>
              )}

              {originSwap.status === 'failed' && originSwap.errorMessage && (
                <p role="alert">{originSwap.errorMessage}</p>
              )}

              {originSwap.status === 'submitted' && !settlement.settled && (
                <p role="status">Waiting for settlement, this can take a few minutes…</p>
              )}

              {settlement.settled && (
                <>
                  <p role="status">Funds have landed in your Stellar account.</p>
                  <DepositSigningPanel
                    status={depositSigning.status}
                    errorMessage={depositSigning.errorMessage}
                    vaultAddress={depositSigning.vaultAddress}
                    amountInSmallestUnits={depositSigning.amountInSmallestUnits}
                    minimumGuaranteedInSmallestUnits={depositSigning.minimumGuaranteedInSmallestUnits}
                    secondsRemaining={depositSigning.secondsRemaining}
                    requiredFeeXLM={depositSigning.requiredFeeXLM}
                    availableXLM={depositSigning.availableXLM}
                    rebuildAnnouncement={depositSigning.rebuildAnnouncement}
                    txHash={depositSigning.txHash}
                    dfTokens={depositSigning.dfTokens}
                    onSign={depositSigning.sign}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
