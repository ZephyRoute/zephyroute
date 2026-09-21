import styles from './TrustBadge.module.css';

/**
 * Communicates the non-custodial invariant at a glance (UX-DR3). Static,
 * non-dismissible, no state changes ever, per Calm over celebration:
 * failures are surfaced elsewhere, never dramatized here. Meaning never
 * depends on the dot's color alone, the sentence always carries it.
 */
export function TrustBadge() {
  return (
    <div className={styles.badge}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.sentence}>Non-custodial. Funds go straight to your wallet.</span>
    </div>
  );
}
