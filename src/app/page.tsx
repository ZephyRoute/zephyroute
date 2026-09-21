'use client';

import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/features/TrustBadge';
import { useWallet } from '@/lib/hooks/useWallet';

export default function Home() {
  const { address, status, errorMessage, connect } = useWallet();

  return (
    <main>
      <TrustBadge />
      <h1>Zephyroute</h1>

      {status !== 'connected' && (
        <Button onClick={connect} disabled={status === 'connecting'}>
          {status === 'connecting' ? 'Connecting…' : 'Connect wallet'}
        </Button>
      )}

      {status === 'connected' && address && (
        <p role="status">Connected: {address}</p>
      )}

      {status === 'failed' && errorMessage && (
        <p role="alert">{errorMessage}</p>
      )}
    </main>
  );
}
