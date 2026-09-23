import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type { SupportedRoute } from '@/lib/routes';

export class SolanaSwapError extends Error {}

/**
 * The same public mainnet RPC endpoint convention `horizon.ts` already
 * uses for Stellar (a free, no-API-key public endpoint, no proprietary
 * infrastructure of Zephyroute's own).
 */
const connection = new Connection('https://api.mainnet-beta.solana.com');

/**
 * Builds the unsigned Solana transaction that sends the quoted USDC
 * amount to 1Click's `depositAddress`, the Solana counterpart to
 * `origin-swap.ts`'s `buildOriginSwapTransaction`. An SPL-token
 * transfer, not a native SOL send, sending native SOL to a USDC
 * deposit address would just lose the funds, the same discipline the
 * EVM path already applies to ERC-20 transfers.
 *
 * The recipient's associated token account may not exist yet (1Click's
 * deposit address is a fresh, per-quote address), so its creation
 * instruction is included idempotently (`...Idempotent...`, succeeds
 * even if the account already exists) rather than requiring a separate
 * existence check first.
 */
export async function buildSolanaSwapTransaction(
  route: SupportedRoute,
  depositorPublicKey: string,
  depositAddress: string,
  amountInSmallestUnits: string
): Promise<Uint8Array> {
  if (route.originChain !== 'solana' || !route.solanaMint) {
    throw new SolanaSwapError(`No Solana mint configured for ${route.label}.`);
  }

  const mint = new PublicKey(route.solanaMint);
  const owner = new PublicKey(depositorPublicKey);
  const destinationOwner = new PublicKey(depositAddress);

  const sourceAta = getAssociatedTokenAddressSync(mint, owner);
  const destinationAta = getAssociatedTokenAddressSync(mint, destinationOwner);

  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(owner, destinationAta, destinationOwner, mint),
    createTransferInstruction(sourceAta, destinationAta, owner, BigInt(amountInSmallestUnits))
  );

  let blockhash: string;
  try {
    ({ blockhash } = await connection.getLatestBlockhash());
  } catch (cause) {
    throw new SolanaSwapError('Could not reach the Solana network. Try again.', { cause });
  }
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner;

  // requireAllSignatures: false, the depositor's own wallet signs this
  // next, review-before-signing (AC #4) happens in the calling hook
  // before this ever reaches the wallet's own signature prompt.
  return new Uint8Array(transaction.serialize({ requireAllSignatures: false }));
}
