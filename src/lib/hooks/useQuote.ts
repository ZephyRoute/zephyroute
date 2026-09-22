'use client';

import { useCallback, useState } from 'react';
import type { QuoteResponse } from '@defuse-protocol/one-click-sdk-typescript';
import type { RequestQuoteParams } from '@/lib/one-click-client';

export type QuoteRequestState = 'idle' | 'loading' | 'ready' | 'rejected' | 'failed';

export interface UseQuoteResult {
  quote: QuoteResponse | null;
  status: QuoteRequestState;
  errorMessage: string | null;
  requestQuoteFor: (params: RequestQuoteParams) => Promise<void>;
}

/**
 * Calls `/api/quote` rather than `lib/one-click-client.ts` directly:
 * that module carries the 1Click JWT, a real per-partner secret per the
 * SDK's own docs, which must never reach the browser (Issue #3). A
 * down/unsupported route rejects here, before the flow ever reaches a
 * signature prompt (AC #5, FR1). All quote fields shown by the caller
 * come straight from `quote.quote`, verbatim, never paraphrased.
 */
export function useQuote(): UseQuoteResult {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [status, setStatus] = useState<QuoteRequestState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestQuoteFor = useCallback(async (params: RequestQuoteParams) => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const payload = await response.json();
      if (!response.ok) {
        setQuote(null);
        setStatus(payload?.error?.code === 'QUOTE_REJECTED' ? 'rejected' : 'failed');
        setErrorMessage(payload?.error?.message ?? 'Could not get a quote. Try again.');
        return;
      }
      setQuote(payload as QuoteResponse);
      setStatus('ready');
    } catch {
      setQuote(null);
      setStatus('failed');
      setErrorMessage('Could not reach the quote service. Try again.');
    }
  }, []);

  return { quote, status, errorMessage, requestQuoteFor };
}
