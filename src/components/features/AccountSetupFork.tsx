import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { OnboardingStatus } from '@/lib/hooks/useEmbeddedWalletOnboarding';
import styles from './AccountSetupFork.module.css';

export interface AccountSetupForkProps {
  status: OnboardingStatus;
  errorMessage: string | null;
  stellarAddress: string | null;
  onCreateAccount: (email: string) => void;
}

const STATUS_LABEL: Record<Exclude<OnboardingStatus, 'idle' | 'failed' | 'completed'>, string> = {
  registering: 'Creating your passkey...',
  funding: 'Preparing your account...',
  signing: 'Waiting for your passkey...',
  submitting: 'Finishing setup...',
};

/**
 * Story 2.1, AC #1: the trustline-missing fork (Story 1.7) is a
 * visible, explicitly named step, never an invisible check that
 * silently changes what a new user sees. Story 2.2, AC #1/#3: the
 * actual mechanism, a passkey-controlled embedded wallet (DFNS) that
 * creates a sponsored Stellar account, Zephyroute never sees or
 * requests the new key.
 */
export function AccountSetupFork({
  status,
  errorMessage,
  stellarAddress,
  onCreateAccount,
}: AccountSetupForkProps) {
  const [email, setEmail] = useState('');
  const inProgress = status !== 'idle' && status !== 'failed' && status !== 'completed';

  return (
    <div className={styles.container}>
      <p role="status" className={styles.headline}>
        Setting up your Stellar account
      </p>
      <p className={styles.explanation}>
        You don&apos;t have a Stellar account with the trustline this destination needs yet.
        We&apos;re routing you through a quick account setup step first, then you&apos;ll
        continue straight into your quote. Your new wallet is controlled by your own passkey,
        never by Zephyroute.
      </p>

      {(status === 'idle' || status === 'failed') && (
        <>
          <label htmlFor="onboarding-email">Email (for account recovery)</label>
          <input
            id="onboarding-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <Button onClick={() => onCreateAccount(email)} disabled={!email}>
            Create my Stellar account
          </Button>
        </>
      )}

      {inProgress && (
        <p className={styles.status}>{STATUS_LABEL[status as keyof typeof STATUS_LABEL]}</p>
      )}

      {status === 'failed' && errorMessage && <p role="alert" className={styles.warning}>{errorMessage}</p>}

      {status === 'completed' && stellarAddress && (
        <p className={styles.status}>
          Your Stellar account is ready ({stellarAddress.slice(0, 6)}...
          {stellarAddress.slice(-6)}).
        </p>
      )}
    </div>
  );
}
