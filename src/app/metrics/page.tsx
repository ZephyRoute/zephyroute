import { computeTractionMetrics } from '@/lib/traction-metrics';
import styles from './page.module.css';

// Story 3.2: always rendered fresh, per-request, never a stale cached
// snapshot for a figure the AC requires to be the exact number usable
// in an SCF tranche submission.
export const dynamic = 'force-dynamic';

function formatStroops(value: string): string {
  return (Number(value) / 1e7).toLocaleString('en-US', { maximumFractionDigits: 7 });
}

/**
 * Story 3.2: project-team-facing traction view, protected by Vercel's
 * own deployment protection (a dashboard setting, not application
 * code, flagged in the PR rather than built here), distinct from
 * Story 1.12's per-address signed-nonce lookup, never exposing any
 * individual address to an arbitrary caller.
 */
export default async function MetricsPage() {
  const metrics = await computeTractionMetrics();

  return (
    <main className={styles.container}>
      <h1>Traction metrics</h1>
      <p className={styles.note}>
        The exact figures backing any SCF tranche submission, computed live from the same
        correlation records the product itself reads, never a separately maintained number.
      </p>

      <dl className={`${styles.grid} tabular`}>
        <dt>Cumulative attributable volume</dt>
        <dd>{formatStroops(metrics.cumulativeAttributableVolume)}</dd>

        <dt>Net-new TVL</dt>
        <dd>{formatStroops(metrics.netNewTVL)}</dd>

        <dt>Unique funded addresses</dt>
        <dd>{metrics.uniqueFundedAddresses}</dd>

        <dt>7-day recurrence rate</dt>
        <dd>{metrics.recurrenceRate7d ?? 'Not yet trackable'}</dd>

        <dt>30-day recurrence rate</dt>
        <dd>{metrics.recurrenceRate30d ?? 'Not yet trackable'}</dd>
      </dl>

      {(metrics.recurrenceRate7d === null || metrics.recurrenceRate30d === null) && (
        <p role="status" className={styles.note}>
          Recurrence rate is not yet computable: the correlation record is stored per address,
          overwritten on each flow, with no per-flow history to derive a recurrence rate from.
        </p>
      )}
    </main>
  );
}
