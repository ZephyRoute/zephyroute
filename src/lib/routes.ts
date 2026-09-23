import type { AssetIdentifier } from '@/lib/horizon';

/**
 * The four routes confirmed live during Phase 2 testing (addendum.md
 * §E), with exact asset IDs verified live against 1Click's public
 * `/v0/tokens` endpoint on 2026-09-21, not invented. Stellar-side assets
 * use a `nep245:` HOT Bridge omni-contract ID, a different shape from
 * every other chain's `nep141:` ID, confirmed here rather than assumed.
 * `stellarAsset` is the same asset's real classic Stellar code/issuer,
 * needed separately for the Horizon trustline check (Story 1.7), since
 * Horizon has no concept of 1Click's own asset ID format.
 *
 * `originChain`/`originContract` are needed for Story 1.8's origin-chain
 * signature: the three USDC routes are ERC-20 transfers (contract
 * address verified live against 1Click's tokens endpoint), the Bitcoin
 * route is a native on-chain send with no EVM wallet involved at all,
 * `originContract` is undefined for it deliberately, not omitted by
 * oversight.
 */
export type OriginChain = 'ethereum' | 'arbitrum' | 'bitcoin';

export interface SupportedRoute {
  label: string;
  originAsset: string;
  originChain: OriginChain;
  originContract?: `0x${string}`;
  originDecimals: number;
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
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
    stellarAsset: STELLAR_USDC,
  },
  {
    label: 'Arbitrum USDC to Stellar USDC',
    originAsset: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
    originChain: 'arbitrum',
    originContract: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    originDecimals: 6,
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
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz',
    stellarAsset: STELLAR_XLM,
  },
];
