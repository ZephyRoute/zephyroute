import { createConfig, http, injected } from 'wagmi';
import { mainnet, arbitrum } from 'viem/chains';

/**
 * EVM origin-chain wallet connectivity (Ethereum, Arbitrum), the
 * counterpart to Stellar Wallets Kit on the destination side. Zephyroute
 * never requests a private key here either, `injected` talks to
 * whatever browser wallet extension (MetaMask, etc.) the user already
 * has, the same non-custodial invariant as the Stellar wallet path.
 *
 * Bitcoin-origin signing (the third supported origin chain) uses a
 * fundamentally different wallet model (PSBT signing, no standardized
 * injected-provider convention the way EVM has one) and is deliberately
 * out of scope for this config; it needs its own integration, tracked
 * separately rather than silently folded in here.
 */
export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
  },
});
