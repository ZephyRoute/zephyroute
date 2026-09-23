import type { AssetIdentifier } from '@/lib/horizon';

/**
 * The routes confirmed live against 1Click, with exact asset IDs
 * verified live against 1Click's public `/v0/tokens` endpoint, not
 * invented. Stellar-side assets use a `nep245:` HOT Bridge omni-contract
 * ID, a different shape from every other chain's `nep141:` ID,
 * confirmed here rather than assumed. `stellarAsset` is the same
 * asset's real classic Stellar code/issuer, needed separately for the
 * Horizon trustline check (Story 1.7), since Horizon has no concept of
 * 1Click's own asset ID format.
 *
 * `originChain`/`originContract` are needed for Story 1.8's origin-chain
 * signature: the USDC routes are ERC-20 transfers (contract address
 * verified live against 1Click's tokens endpoint), the Bitcoin route is
 * a native on-chain send with no EVM wallet involved at all,
 * `originContract` is undefined for it deliberately, not omitted by
 * oversight. `chainId` is the EVM chain wagmi must target when sending
 * the origin-chain transaction (PRD Open Question 3's `useOriginSwap`
 * follow-on fix: without it, `sendTransactionAsync` submits on whatever
 * chain the wallet happens to already be connected to, not necessarily
 * the selected route's chain, a real correctness gap once more than one
 * EVM chain is offered), left `undefined` for Bitcoin since it never
 * reaches the EVM signing path at all.
 */
export type OriginChain = 'ethereum' | 'arbitrum' | 'base' | 'bitcoin';

export interface SupportedRoute {
  label: string;
  originAsset: string;
  originChain: OriginChain;
  originContract?: `0x${string}`;
  originDecimals: number;
  chainId?: number;
  destinationAsset: string;
  stellarAsset: AssetIdentifier;
}

export const STELLAR_USDC: AssetIdentifier = {
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};

const STELLAR_XLM: AssetIdentifier = { code: 'XLM' };

export const SUPPORTED_ROUTES: SupportedRoute[] = [
  {
    label: 'Ethereum USDC to Stellar USDC',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    originChain: 'ethereum',
    originContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    originDecimals: 6,
    chainId: 1,
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
    stellarAsset: STELLAR_USDC,
  },
  {
    label: 'Arbitrum USDC to Stellar USDC',
    originAsset: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
    originChain: 'arbitrum',
    originContract: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    originDecimals: 6,
    chainId: 42161,
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
    stellarAsset: STELLAR_USDC,
  },
  {
    /**
     * Story 1.8's original 3 routes were the only ones confirmed live
     * during Phase 2 testing (addendum.md §E); Base was confirmed
     * separately, live, 2026-09-22, re-verifying PRD Open Question 3
     * ("Base and Solana origin routes are currently down upstream at
     * 1Click"). A real `dry: true` quote request against 1Click's
     * production `/v0/quote` endpoint for this exact asset pair
     * (correlation ID `bf986d74-2b78-4fe4-8c4e-127680241baf`) returned a
     * fully priced, signed quote, not just a token listing, confirming
     * the route itself works end to end, not merely that the asset is
     * catalogued. Solana was verified the same way but isn't added
     * here: Solana isn't EVM-compatible, wagmi/viem's `injected()`
     * connector can't sign for it, and adding it needs its own wallet
     * adapter integration (Phantom/Solflare, a different signing model
     * entirely), a separate, larger piece of work, not a config change.
     */
    label: 'Base USDC to Stellar USDC',
    originAsset: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
    originChain: 'base',
    originContract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    originDecimals: 6,
    chainId: 8453,
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
    stellarAsset: STELLAR_USDC,
  },
  {
    label: 'Bitcoin BTC to Stellar USDC',
    originAsset: 'nep141:btc.omft.near',
    originChain: 'bitcoin',
    originDecimals: 8,
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
    stellarAsset: STELLAR_USDC,
  },
  {
    label: 'Ethereum USDC to Stellar XLM',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    originChain: 'ethereum',
    originContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    originDecimals: 6,
    chainId: 1,
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz',
    stellarAsset: STELLAR_XLM,
  },
];
