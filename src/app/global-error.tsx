'use client';

import { useEffect } from 'react';

/**
 * Issue #55: the root-level fallback for errors `error.tsx` itself
 * can't catch (errors in the root layout). Must define its own
 * `<html>`/`<body>`, global-error doesn't inherit globals.css or fonts
 * (Next.js's own docs are explicit about this), so this stays plain
 * rather than half-matching the app's real styling.
 */
export default function GlobalError({
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
    <html lang="en">
      <body>
        <div role="alert">
          <h2>Something went wrong.</h2>
          <p>
            This was not a failed deposit or signature, those are reported separately. If you
            were mid-flow, check your wallet and the correlation status before retrying.
          </p>
          <button onClick={() => retry()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
