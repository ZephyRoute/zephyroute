'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Issue #57: no `WagmiProvider` here. wagmi/viem are real bundle weight
 * (the same reasoning that already kept Solana's and DFNS's SDKs out
 * of the eager path, Issue #25), only worth loading for a session that
 * actually signs an EVM-origin transaction. `useOriginSwap` dynamically
 * imports `@/lib/wagmi-config` and `wagmi/actions`'s imperative API
 * directly when that happens, with no React Context dependency.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
