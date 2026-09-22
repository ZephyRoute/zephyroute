import styles from './AccountSetupFork.module.css';

export interface AccountSetupForkProps {
  /**
   * Story 2.2 fills this in with the real embedded-wallet mechanism;
   * until then, an honest placeholder rather than a silent block (the
   * same discipline Story 1.7 already applied to this exact fork).
   */
  mechanismAvailable?: boolean;
}

/**
 * Story 2.1, AC #1: the trustline-missing fork (Story 1.7) becomes a
 * visible, explicitly named step here, never an invisible check that
 * silently changes what a new user sees or a generic error alert.
 */
export function AccountSetupFork({ mechanismAvailable = false }: AccountSetupForkProps) {
  return (
    <div className={styles.container}>
      <p role="status" className={styles.headline}>
        Setting up your Stellar account
      </p>
      <p className={styles.explanation}>
        You don&apos;t have a Stellar account with the trustline this destination needs yet.
        We&apos;re routing you through a quick account setup step first, then you&apos;ll
        continue straight into your quote.
      </p>
      {!mechanismAvailable && (
        <p role="alert" className={styles.warning}>
          Automatic account setup isn&apos;t available in this build yet. Check back soon.
        </p>
      )}
    </div>
  );
}
