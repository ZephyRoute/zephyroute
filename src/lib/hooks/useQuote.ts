'use client';

import { useCallback, useState } from 'react';
import type { QuoteResponse } from '@defuse-protocol/one-click-sdk-typescript';
import { requestQuote, QuoteRejectedError, type RequestQuoteParams } from '@/lib/one-click-client';

export type QuoteRequestState = 'idle' | 'loading' | 'ready' | 'rejected' | 'failed';

export interface UseQuoteResult {
  quote: QuoteResponse | null;
  status: QuoteRequestState;
  errorMessage: string | null;
  requestQuoteFor: (params: RequestQuoteParams) => Promise<void>;
}

/**
 * A down/unsupported route rejects here, before the flow ever reaches a
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
      const response = await requestQuote(params);
      setQuote(response);
      setStatus('ready');
    } catch (error) {
      setQuote(null);
      setStatus(error instanceof QuoteRejectedError ? 'rejected' : 'failed');
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not get a quote. Try again.'
      );
    }
  }, []);

  return { quote, status, errorMessage, requestQuoteFor };
}
