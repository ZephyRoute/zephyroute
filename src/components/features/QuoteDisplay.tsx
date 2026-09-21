import type { QuoteResponse } from '@defuse-protocol/one-click-sdk-typescript';
import { Disclosure } from '@/components/ui/Disclosure';
import styles from './QuoteDisplay.module.css';

export interface QuoteDisplayProps {
  quote: QuoteResponse;
}

/**
 * FR1: fee, ETA, slippageTolerance, minAmountOut, and refund fields are
 * shown verbatim, never paraphrased or rounded. The compressed line is
 * the returning-user (UJ-1) variant of Guided Status; the full-sentence
 * variant for new users is Story 2.1's concern, not this one.
 */
export function QuoteDisplay({ quote }: QuoteDisplayProps) {
  const { quote: q, quoteRequest } = quote;

  return (
    <div className={styles.container}>
      <p className={`${styles.headline} tabular`}>
        {q.amountOutFormatted} for {q.amountInFormatted}, ~{q.timeEstimate}s
      </p>
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
