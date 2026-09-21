/**
 * The four routes confirmed live during Phase 2 testing (addendum.md
 * §E), with exact asset IDs verified live against 1Click's public
 * `/v0/tokens` endpoint on 2026-09-21, not invented. Stellar-side assets
 * use a `nep245:` HOT Bridge omni-contract ID, a different shape from
 * every other chain's `nep141:` ID, confirmed here rather than assumed.
 */
export interface SupportedRoute {
  label: string;
  originAsset: string;
  destinationAsset: string;
}

export const SUPPORTED_ROUTES: SupportedRoute[] = [
  {
    label: 'Ethereum USDC to Stellar USDC',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
  },
  {
    label: 'Arbitrum USDC to Stellar USDC',
    originAsset: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
  },
  {
    label: 'Bitcoin BTC to Stellar USDC',
    originAsset: 'nep141:btc.omft.near',
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
  },
  {
    label: 'Ethereum USDC to Stellar XLM',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz',
  },
];
