'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Issue #55: before this, an unhandled runtime error (a genuine bug, an
 * unexpected null, a third-party SDK throwing synchronously) had no
 * fallback UI at all, functionally a silent failure from the user's
 * own perspective even though CLAUDE.md's AC #5 already requires one
 * for request/signing failures specifically. This is the one failure
 * mode that AC didn't yet cover.
 */
export default function Error({
  error,
  retry,
}: {
  error: globalThis.Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
      <h2>Something went wrong.</h2>
      <p>
        This was not a failed deposit or signature, those are reported separately. If you were
        mid-flow, check your wallet and the correlation status before retrying.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
