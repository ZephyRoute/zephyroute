import { Button } from '@/components/ui/Button';
import type { DepositSigningStatus } from '@/lib/hooks/useDepositSigning';
import styles from './DepositSigningPanel.module.css';

export interface DepositSigningPanelProps {
  status: DepositSigningStatus;
  errorMessage: string | null;
  vaultAddress: string | null;
  amountInSmallestUnits: string | null;
  minimumGuaranteedInSmallestUnits: string | null;
  secondsRemaining: number | null;
  requiredFeeXLM: string | null;
  availableXLM: string | null;
  rebuildAnnouncement: string | null;
  txHash: string | null;
  onSign: () => void;
}

// Stellar assets use 7 decimal places (the same precision the rest of
// this project's smallest-unit amounts already assume, e.g. Story 1.9).
const STELLAR_DECIMALS = 10000000;

function formatSmallestUnits(value: string): string {
  return (Number(value) / STELLAR_DECIMALS).toFixed(7);
}

function truncateAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-6)}` : address;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

/**
 * Story 1.10: the review-before-signing surface (AC #4 in CLAUDE.md).
 * Destination, amount, and minimum guaranteed balance are always
 * visible alongside the Sign action, never just implied. The
 * `aria-live` region always renders, even empty, so a later
 * announcement (an auto-rebuild) is reliably picked up by assistive
 * tech (AC #2).
 */
export function DepositSigningPanel({
  status,
  errorMessage,
  vaultAddress,
  amountInSmallestUnits,
  minimumGuaranteedInSmallestUnits,
  secondsRemaining,
  requiredFeeXLM,
  availableXLM,
  rebuildAnnouncement,
  txHash,
  onSign,
}: DepositSigningPanelProps) {
  return (
    <div className={styles.container}>
      <p aria-live="polite" className={styles.announcement}>
        {rebuildAnnouncement ?? ''}
      </p>

      {status === 'building' && <p className={styles.status}>Preparing your deposit...</p>}

      {status === 'insufficient-fee' && (
        <p className={styles.warning}>
          You need {requiredFeeXLM} XLM to cover this deposit&apos;s network fee, but your
          Stellar account only holds {availableXLM} XLM. Add a small amount of XLM and try again.
        </p>
      )}

      {status === 'disconnected' && (
        <p className={styles.warning}>
          Your wallet disconnected before the signature completed. Reconnect your wallet to try
          again, nothing was signed.
        </p>
      )}

      {(status === 'ready-to-sign' || status === 'signing' || status === 'submitting') &&
        vaultAddress &&
        amountInSmallestUnits &&
        minimumGuaranteedInSmallestUnits && (
          <>
            <dl className={`${styles.details} tabular`}>
              <dt>Destination vault</dt>
              <dd>{truncateAddress(vaultAddress)}</dd>
              <dt>Amount</dt>
              <dd>{formatSmallestUnits(amountInSmallestUnits)}</dd>
              <dt>Minimum guaranteed</dt>
              <dd>{formatSmallestUnits(minimumGuaranteedInSmallestUnits)}</dd>
            </dl>
            {secondsRemaining !== null && (
              <p className={`${styles.countdown} tabular`}>
                Sign within {formatCountdown(secondsRemaining)}
              </p>
            )}
            <Button onClick={onSign} disabled={status !== 'ready-to-sign'}>
              {status === 'signing'
                ? 'Waiting for signature...'
                : status === 'submitting'
                  ? 'Submitting...'
                  : 'Sign deposit'}
            </Button>
          </>
        )}

      {status === 'submitted' && txHash && (
        <p className={styles.status}>Deposit submitted. Transaction: {truncateAddress(txHash)}</p>
      )}

      {status === 'failed' && errorMessage && <p className={styles.warning}>{errorMessage}</p>}
    </div>
  );
}
