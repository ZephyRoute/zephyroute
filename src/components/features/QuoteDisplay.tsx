import type { QuoteResponse } from '@defuse-protocol/one-click-sdk-typescript';
import { Disclosure } from '@/components/ui/Disclosure';
import styles from './QuoteDisplay.module.css';

export interface QuoteDisplayProps {
  quote: QuoteResponse;
  /**
   * The plain-language line's two depths (Design Direction Decision):
   * `'returning'` is the compressed, numbers-first UJ-1 variant;
   * `'new'` is the full-sentence UJ-2 variant (Story 2.1, AC #2). Both
   * embed the same real, verbatim numbers, never a paraphrase.
   */
  variant?: 'returning' | 'new';
}

/**
 * FR1: fee, ETA, slippageTolerance, minAmountOut, and refund fields are
 * shown verbatim, never paraphrased or rounded.
 */
export function QuoteDisplay({ quote, variant = 'returning' }: QuoteDisplayProps) {
  const { quote: q, quoteRequest } = quote;

  return (
    <div className={styles.container}>
      {variant === 'new' ? (
        <p className={`${styles.headline} tabular`}>
          You&apos;ll receive {q.amountOutFormatted} in your Stellar account for the{' '}
          {q.amountInFormatted} you&apos;re sending, in about {q.timeEstimate} seconds.
        </p>
      ) : (
        <p className={`${styles.headline} tabular`}>
          {q.amountOutFormatted} for {q.amountInFormatted}, ~{q.timeEstimate}s
        </p>
      )}
      <p className={`${styles.feeRow} tabular`}>Min received: {q.minAmountOut}</p>

      <Disclosure summary="See full quote">
        <dl className={`${styles.fullQuote} tabular`}>
          <dt>Amount in</dt>
          <dd>{q.amountIn}</dd>
          <dt>Amount out</dt>
          <dd>{q.amountOut}</dd>
          <dt>Minimum received</dt>
          <dd>{q.minAmountOut}</dd>
          <dt>Slippage tolerance</dt>
          <dd>{quoteRequest.slippageTolerance} bps</dd>
          <dt>Refund to</dt>
          <dd>{quoteRequest.refundTo}</dd>
          <dt>Refund type</dt>
          <dd>{quoteRequest.refundType}</dd>
          {q.refundFee && (
            <>
              <dt>Refund fee</dt>
              <dd>{q.refundFee}</dd>
            </>
          )}
          <dt>Estimated time</dt>
          <dd>{q.timeEstimate}s</dd>
        </dl>
      </Disclosure>
    </div>
  );
}
