import { encodeFunctionData, type Hex } from 'viem';
import type { SupportedRoute } from '@/lib/routes';

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export interface OriginSwapTransaction {
  to: `0x${string}`;
  data?: Hex;
  value?: bigint;
}

export class UnsupportedOriginChainError extends Error {}

/**
 * Builds the transaction that sends the quoted amount to 1Click's
 * `depositAddress`, the origin-chain "swap" signature Story 1.8's AC
 * refers to. For an ERC-20 origin asset (every route except Bitcoin),
 * this is a `transfer()` call to the token contract, never a native
 * value send, sending native ETH to a USDC deposit address would just
 * lose the funds.
 *
 * `amountInSmallestUnits` must be `quote.quote.amountIn` verbatim, the
 * exact amount 1Click quoted, already in the asset's smallest units,
 * never re-derived from the user's original input, which could drift
 * from what was actually quoted.
 *
 * Bitcoin has no EVM wallet or injected-provider signing convention;
 * this deliberately throws rather than silently producing a
 * meaningless transaction shape for a chain wagmi cannot sign for.
 */
export function buildOriginSwapTransaction(
  route: SupportedRoute,
  depositAddress: string,
  amountInSmallestUnits: string
): OriginSwapTransaction {
  if (route.originChain === 'bitcoin') {
    throw new UnsupportedOriginChainError(
      'Bitcoin-origin signing needs its own wallet integration, not the EVM path.'
    );
  }
  if (!route.originContract) {
    throw new UnsupportedOriginChainError(`No ERC-20 contract configured for ${route.label}.`);
  }

  return {
    to: route.originContract,
    data: encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [depositAddress as `0x${string}`, BigInt(amountInSmallestUnits)],
    }),
  };
}
