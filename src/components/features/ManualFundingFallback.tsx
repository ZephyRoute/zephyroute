import { Button } from '@/components/ui/Button';
import type { AssetIdentifier } from '@/lib/horizon';
import styles from './ManualFundingFallback.module.css';

export interface ManualFundingFallbackProps {
  stellarAddress: string;
  asset: AssetIdentifier;
  checking: boolean;
  onCheckAgain: () => void;
}

/**
 * Story 2.3: the documented fallback for when embedded-wallet
 * onboarding isn't available (AC: automatic account setup down or
 * unconfigured). Every instruction sends funds to the user's own
 * already-connected address, never to a Zephyroute-controlled one,
 * the gateway never holds custody at any point here.
 */
export function ManualFundingFallback({
  stellarAddress,
  asset,
  checking,
  onCheckAgain,
}: ManualFundingFallbackProps) {
  return (
    <div className={styles.container}>
      <p role="status" className={styles.headline}>
        Automatic account setup isn&apos;t available right now
      </p>
      <p className={styles.explanation}>
        You can still fund your own account yourself, in your own wallet. Zephyroute never
        holds or touches your funds at any point in this process.
      </p>

      <ol className={styles.steps}>
        <li>
          Send at least 2 XLM to your own address:
          <code className={`${styles.address} tabular`}>{stellarAddress}</code>
          This covers your account&apos;s minimum network reserve, it stays yours.
        </li>
        {asset.issuer && (
          <li>
            In your wallet, add a trustline for {asset.code}, issued by:
            <code className={`${styles.address} tabular`}>{asset.issuer}</code>
            Most Stellar wallets call this &quot;Add asset&quot; or &quot;Add trustline&quot;.
          </li>
        )}
        <li>Once both steps are done, check again below to continue with your quote.</li>
      </ol>

      <Button onClick={onCheckAgain} disabled={checking}>
        {checking ? 'Checking...' : "I've funded my account, check again"}
      </Button>
    </div>
  );
}
