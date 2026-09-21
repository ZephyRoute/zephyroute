'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/features/TrustBadge';
import { QuoteDisplay } from '@/components/features/QuoteDisplay';
import { useWallet } from '@/lib/hooks/useWallet';
import { useQuote } from '@/lib/hooks/useQuote';
import { useTrustlineCheck } from '@/lib/hooks/useTrustlineCheck';
import { SUPPORTED_ROUTES } from '@/lib/routes';

export default function Home() {
  const { address, status: walletStatus, errorMessage: walletError, connect } = useWallet();
  const { quote, status: quoteStatus, errorMessage: quoteError, requestQuoteFor } = useQuote();
  const trustline = useTrustlineCheck();
  const [routeIndex, setRouteIndex] = useState(0);
  const [amount, setAmount] = useState('');

  const handleRequestQuote = async () => {
    if (!address || !amount) return;
    const route = SUPPORTED_ROUTES[routeIndex];

    // FR3: the trustline check runs before the quote request fires, not after.
    const present = await trustline.check(address, route.stellarAsset);
    if (!present) return;

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

  return (
    <main>
      <TrustBadge />
      <h1>Zephyroute</h1>

      {walletStatus !== 'connected' && (
        <Button onClick={connect} disabled={walletStatus === 'connecting'}>
          {walletStatus === 'connecting' ? 'Connecting…' : 'Connect wallet'}
        </Button>
      )}

      {walletStatus === 'connected' && address && (
        <p role="status">Connected: {address}</p>
      )}

      {walletStatus === 'failed' && walletError && <p role="alert">{walletError}</p>}

      {walletStatus === 'connected' && (
        <div>
          <label htmlFor="route-select">Route</label>
          <select
            id="route-select"
            value={routeIndex}
            onChange={(event) => setRouteIndex(Number(event.target.value))}
          >
            {SUPPORTED_ROUTES.map((route, index) => (
              <option key={route.label} value={index}>
                {route.label}
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
          />

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

          {quoteStatus === 'ready' && quote && <QuoteDisplay quote={quote} />}
        </div>
      )}
    </main>
  );
}
