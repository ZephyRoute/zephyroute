'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/features/TrustBadge';
import { QuoteDisplay } from '@/components/features/QuoteDisplay';
import { StepTracker } from '@/components/features/StepTracker';
import { DepositSigningPanel } from '@/components/features/DepositSigningPanel';
import { AccountSetupFork } from '@/components/features/AccountSetupFork';
import { ManualFundingFallback } from '@/components/features/ManualFundingFallback';
import { useActiveIdentity } from '@/lib/hooks/useActiveIdentity';
import { useQuote } from '@/lib/hooks/useQuote';
import { useTrustlineCheck } from '@/lib/hooks/useTrustlineCheck';
import { useOriginSwap } from '@/lib/hooks/useOriginSwap';
import { useSettlementStatus } from '@/lib/hooks/useSettlementStatus';
import { useDepositSigning } from '@/lib/hooks/useDepositSigning';
import { useCorrelationResume } from '@/lib/hooks/useCorrelationResume';
import { getAssetBalance } from '@/lib/horizon';
import { SUPPORTED_ROUTES } from '@/lib/routes';
import type { FlowStage } from '@/lib/types';

/**
 * Story 4.1, AC #1 (FR12): the exact same flow, standalone or
 * embedded. `/` and `/embed` both render this component; the widget
 * reuses `components/features/`/`components/ui/` rather than a
 * separate implementation, since forking would mean every future
 * story has to be built twice.
 *
 * Attribution decision (Story 4.1, AC #2): `integratorId` stays the
 * literal `'zephyroute'` regardless of entry point, never a partner-
 * specific or sub-attributed value. No partner 1Click integrator
 * credential exists (none has ever been registered), and
 * `lib/traction-metrics.ts` doesn't group or filter by `integratorId`,
 * so a different value per entry point would silently under- or
 * double-count traction depending on interpretation. Revisit only once
 * an actual partner with its own 1Click integrator credential is
 * confirmed.
 */
export function ZephyrouteFlow() {
  const identity = useActiveIdentity();
  const { address, status: walletStatus, errorMessage: walletError } = identity;
  const { connect } = identity.wallet;
  const onboarding = identity.onboarding;
  const { quote, status: quoteStatus, errorMessage: quoteError, requestQuoteFor } = useQuote();
  const trustline = useTrustlineCheck();
  const originSwap = useOriginSwap();
  const depositSigning = useDepositSigning();
  const resume = useCorrelationResume();
  const [routeIndex, setRouteIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [baselineBalance, setBaselineBalance] = useState<string | null>(null);
  const correlationWrittenRef = useRef(false);
  const depositStartedRef = useRef(false);
  const resumeCheckedRef = useRef(false);

  const route = SUPPORTED_ROUTES[routeIndex];

  // Story 1.12: on every reconnect, check once whether this address
  // already has a settled-but-undeposited balance or a completed
  // deposit, before showing the normal quote flow at all.
  useEffect(() => {
    if (!address || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    resume.check(address);
  }, [address, resume]);

  // AC #1: resumed directly at the deposit-signing step, never asked
  // to re-quote or re-sign the origin-chain swap.
  useEffect(() => {
    if (resume.status !== 'resumable-deposit' || !resume.resumableDeposit || !address) return;
    if (depositStartedRef.current) return;
    depositStartedRef.current = true;
    depositSigning.start({
      depositorAddress: address,
      amountInSmallestUnits: resume.resumableDeposit.settledAmount,
      slippageBps: 100,
      signingSource: identity.source ?? undefined,
      dfnsWalletId: identity.dfnsWalletId ?? undefined,
    });
  }, [resume.status, resume.resumableDeposit, address, depositSigning, identity.source, identity.dfnsWalletId]);

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
      signingSource: identity.source ?? undefined,
      dfnsWalletId: identity.dfnsWalletId ?? undefined,
    });
  }, [settlement.settled, address, quote, depositSigning, identity.source, identity.dfnsWalletId]);

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

  const depositSigningPanel = (
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
  );

  return (
    <main>
      <TrustBadge />
      <h1>Zephyroute</h1>

      {walletStatus !== 'connected' && (
        <>
          <Button onClick={connect} disabled={walletStatus === 'connecting'}>
            {walletStatus === 'connecting' ? 'Connecting…' : 'Connect wallet'}
          </Button>

          {/* Issue #16, gap #1: reachable before any wallet is
              connected at all, a visitor with zero Stellar wallet
              software installed could never reach this fork before,
              since it only ever rendered after a missing-trustline
              check that itself required an already-connected address. */}
          {!onboarding.providerUnavailable && (
            <AccountSetupFork
              context="no-wallet"
              status={onboarding.status}
              errorMessage={onboarding.errorMessage}
              stellarAddress={onboarding.stellarAddress}
              onCreateAccount={(email) => onboarding.onboard(email, route.stellarAsset)}
            />
          )}
        </>
      )}

      {walletStatus === 'connected' && address && <p role="status">Connected: {address}</p>}

      {walletStatus === 'failed' && walletError && <p role="alert">{walletError}</p>}

      {walletStatus === 'connected' && (
        <div>
          {resume.status === 'checking' && (
            <p role="status">Checking for anything already in progress…</p>
          )}

          {resume.status === 'failed' && resume.errorMessage && (
            <p role="alert">{resume.errorMessage}</p>
          )}

          {resume.status === 'earning' && resume.earningPosition && (
            <p role="status">
              You&apos;re already earning yield in the vault ({resume.earningPosition.dfTokens}{' '}
              shares).
            </p>
          )}

          {resume.status === 'resumable-deposit' && (
            <>
              <p role="status">Resuming your deposit from where you left off.</p>
              <StepTracker
                stage="depositing"
                failed={depositSigning.status === 'failed' || depositSigning.status === 'reverted'}
              />
              {depositSigningPanel}
            </>
          )}

          {(resume.status === 'none' || resume.status === 'failed') && (
            <>
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

              {trustline.status === 'missing' && !onboarding.providerUnavailable && (
                <AccountSetupFork
                  status={onboarding.status}
                  errorMessage={onboarding.errorMessage}
                  stellarAddress={onboarding.stellarAddress}
                  onCreateAccount={(email) => onboarding.onboard(email, route.stellarAsset)}
                />
              )}

              {(trustline.status === 'missing' || trustline.status === 'checking') &&
                onboarding.providerUnavailable &&
                address && (
                  <ManualFundingFallback
                    stellarAddress={address}
                    asset={route.stellarAsset}
                    checking={trustline.status === 'checking'}
                    onCheckAgain={() => trustline.check(address, route.stellarAsset)}
                  />
                )}

              {trustline.status === 'failed' && trustline.errorMessage && (
                <p role="alert">{trustline.errorMessage}</p>
              )}

              {(quoteStatus === 'rejected' || quoteStatus === 'failed') && quoteError && (
                <p role="alert">{quoteError}</p>
              )}

              {quoteStatus === 'ready' && quote && (
                <>
                  <QuoteDisplay quote={quote} variant={trustline.everMissing ? 'new' : 'returning'} />

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
                      {depositSigningPanel}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
