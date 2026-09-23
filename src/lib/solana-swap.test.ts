// @vitest-environment node
//
// jsdom's `crypto` global is incompatible with `@noble/curves` (a
// `@solana/web3.js` dependency): under jsdom, `PublicKey.
// findProgramAddressSync`'s curve-point validation fails with "Unable
// to find a viable program address nonce" for every input, a genuine,
// reproduced environment issue, not a bug in this module (the exact
// same derivation succeeds in a plain Node script). This module has no
// DOM/React dependency, so the real Node environment is correct here
// regardless.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  decodeTransferInstructionUnchecked,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { SupportedRoute } from '@/lib/routes';
import { buildSolanaSwapTransaction, SolanaSwapError } from './solana-swap';

// A targeted spy on the real class's own method, not a full
// `vi.mock('@solana/web3.js', ...)`: replacing the whole module broke
// `getAssociatedTokenAddressSync`'s internal curve-point derivation in
// `@solana/spl-token` (a real, reproduced interaction, not theorized),
// since spl-token's own internal import of `@solana/web3.js` resolves
// through the same mocked registry entry. Spying on the prototype
// method leaves `PublicKey` and everything else genuinely real.
let getLatestBlockhashSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getLatestBlockhashSpy = vi.spyOn(Connection.prototype, 'getLatestBlockhash');
});

afterEach(() => {
  getLatestBlockhashSpy.mockRestore();
});

const solanaRoute: SupportedRoute = {
  label: 'Solana USDC to Stellar USDC',
  originAsset: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
  originChain: 'solana',
  originDecimals: 6,
  solanaMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  destinationAsset: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu',
  stellarAsset: { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
};

const DEPOSITOR = '5TYZChz7APFopR5QirD5of4rQj1p9AXxeSAg6JndBdGj';
const DEPOSIT_ADDRESS = 'BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG';

describe('buildSolanaSwapTransaction', () => {
  it(
    'builds an idempotent-create-ATA plus SPL transfer() to the deposit address\'s own associated ' +
      'token account, using the quoted amount verbatim, never a native SOL send',
    async () => {
      getLatestBlockhashSpy.mockResolvedValue({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 1,
      });

      const serialized = await buildSolanaSwapTransaction(
        solanaRoute,
        DEPOSITOR,
        DEPOSIT_ADDRESS,
        '10000000'
      );

      const transaction = Transaction.from(Buffer.from(serialized));
      expect(transaction.instructions).toHaveLength(2);

      const [createAtaIx, transferIx] = transaction.instructions;
      // The create-ATA instruction targets the Associated Token
      // Account program, never the token program directly.
      expect(createAtaIx.programId.toBase58()).toBe(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());

      const decoded = decodeTransferInstructionUnchecked(transferIx);
      const mint = new PublicKey(solanaRoute.solanaMint!);
      const owner = new PublicKey(DEPOSITOR);
      const destinationOwner = new PublicKey(DEPOSIT_ADDRESS);
      expect(decoded.keys.source?.pubkey.toBase58()).toBe(
        getAssociatedTokenAddressSync(mint, owner).toBase58()
      );
      expect(decoded.keys.destination?.pubkey.toBase58()).toBe(
        getAssociatedTokenAddressSync(mint, destinationOwner).toBase58()
      );
      expect(decoded.data.amount).toBe(BigInt(10000000));
    }
  );

  it('refuses to build a transaction for a route with no Solana mint configured', async () => {
    const evmRoute: SupportedRoute = { ...solanaRoute, originChain: 'ethereum', solanaMint: undefined };

    await expect(
      buildSolanaSwapTransaction(evmRoute, DEPOSITOR, DEPOSIT_ADDRESS, '10000000')
    ).rejects.toBeInstanceOf(SolanaSwapError);
  });

  it('surfaces a network failure fetching the blockhash explicitly, never a silent hang', async () => {
    getLatestBlockhashSpy.mockRejectedValue(new Error('RPC unreachable'));

    await expect(
      buildSolanaSwapTransaction(solanaRoute, DEPOSITOR, DEPOSIT_ADDRESS, '10000000')
    ).rejects.toBeInstanceOf(SolanaSwapError);
  });
});
