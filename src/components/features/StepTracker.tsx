import type { FlowStage } from '@/lib/types';
import styles from './StepTracker.module.css';

export interface StepTrackerProps {
  stage: FlowStage;
  failed?: boolean;
  timestamps?: Partial<Record<'quoted' | 'settled' | 'earning', string>>;
}

type StepState = 'upcoming' | 'active' | 'done' | 'failed';

const RAIL_STEPS = [
  { key: 'quoted' as const, label: 'Quoted' },
  { key: 'settled' as const, label: 'Settled' },
  { key: 'earning' as const, label: 'Earning' },
];

/**
 * UX-DR5: the compressed 3-label rail (Quoted, Settled, Earning) over
 * the richer 5-stage FlowStage state machine. `submitted` renders as
 * Quoted-done/Settled-active (in flight toward settlement);
 * `depositing` renders as Settled-done/Earning-active (in flight
 * toward the deposit landing). Every completion timestamp comes from
 * the caller, sourced from the originating record, never the client's
 * local clock (Independent auditability).
 */
export function StepTracker({ stage, failed = false, timestamps = {} }: StepTrackerProps) {
  const stepState = (key: 'quoted' | 'settled' | 'earning'): StepState => {
    const order: FlowStage[] = ['quoted', 'submitted', 'settled', 'depositing', 'earning'];
    const stageIndex = order.indexOf(stage);
    const stepIndex = order.indexOf(key);

    // "submitted" and "depositing" are in-flight toward the next labeled
    // step, so that labeled step is the effective current one, not
    // merely upcoming, whether the flow is healthy or has just failed.
    const isCurrent =
      stepIndex === stageIndex ||
      (key === 'settled' && stage === 'submitted') ||
      (key === 'earning' && stage === 'depositing');

    if (failed) {
      return isCurrent || stepIndex < stageIndex ? 'failed' : 'upcoming';
    }
    if (isCurrent) return 'active';
    if (stepIndex < stageIndex) return 'done';
    return 'upcoming';
  };

  return (
    <ol className={styles.rail}>
      {RAIL_STEPS.map(({ key, label }) => {
        const state = stepState(key);
        return (
          <li
            key={key}
            className={`${styles.step} ${styles[state]}`}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className={styles.indicator} aria-hidden="true" />
            <span className={styles.label}>
              {label}
              {state === 'failed' && ' (failed)'}
            </span>
            {timestamps[key] && state === 'done' && (
              <time className={styles.timestamp} dateTime={timestamps[key]}>
                {new Date(timestamps[key]!).toLocaleTimeString()}
              </time>
            )}
          </li>
        );
      })}
    </ol>
  );
}
