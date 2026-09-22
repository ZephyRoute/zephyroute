import { DefindexSDK, SupportedNetworks } from '@defindex/sdk';
import { validateTransactionXDR } from '@/lib/validation';
import type { ValidatedTransactionXDR } from '@/lib/types';

let sdk: DefindexSDK | null = null;

function getSdk(): DefindexSDK {
  if (sdk) return sdk;
  sdk = new DefindexSDK({
    apiKey: process.env.DEFINDEX_API_KEY,
    defaultNetwork: SupportedNetworks.MAINNET,
  });
  return sdk;
}

export class DepositBuildError extends Error {}

/**
 * The default USDC Blend Autocompound vault's real mainnet contract
 * address was never verified against a live source this project could
 * confirm (checked directly, 2026-09-21: DeFindex's own public
 * `mainnet.contracts.json` only publishes the Factory and Blend
 * *strategy* addresses, not a specific deployed vault instance, and
 * every vault address found via search was testnet-only). Configurable
 * rather than hardcoded to a guess, must be set to a real, confirmed
 * mainnet vault address before this can go live; deliberately throws
 * instead of silently building a deposit against an unverified guess.
 */
function requiredVaultAddress(): string {
  const address = process.env.DEFINDEX_VAULT_ADDRESS;
  if (!address) {
    throw new DepositBuildError(
      'DEFINDEX_VAULT_ADDRESS is not configured. The real mainnet USDC Blend Autocompound vault address must be confirmed and set before building a deposit.'
    );
  }
  return address;
}

/**
 * FR7: builds an unsigned deposit() XDR, `invest: true` by default,
 * `slippageBps` always a real, non-zero value so the resulting
 * on-chain `amounts_min` is genuinely slippage-protected, never left
 * to a permissive default. AC #3/#4: the returned XDR is validated
 * internally before being handed back, never returned unvalidated.
 */
export async function buildDepositTransaction(
  depositorAddress: string,
  amountInSmallestUnits: string,
  slippageBps = 100
): Promise<{ xdr: ValidatedTransactionXDR; vaultAddress: string }> {
  const vaultAddress = requiredVaultAddress();

  let response;
  try {
    response = await getSdk().depositToVault(vaultAddress, {
      caller: depositorAddress,
      amounts: [Number(amountInSmallestUnits)],
      slippageBps,
      invest: true,
    });
  } catch (cause) {
    throw new DepositBuildError('Could not prepare the deposit. Try again.', { cause });
  }

  if (!response.xdr) {
    throw new DepositBuildError('DeFindex did not return a deposit transaction to sign.');
  }

  // AC #3/#4: validated before ever being returned to a caller, never
  // handed back as a raw, unvalidated string. `vaultAddress` is
  // returned alongside so the UI can render the real destination
  // before the signature prompt (Story 1.10, AC #1) without needing
  // its own copy of the server-only env var.
  return { xdr: validateTransactionXDR(response.xdr), vaultAddress };
}

export class VaultBalanceQueryError extends Error {}

/**
 * Story 1.11, AC #2: reads the depositor's real dfToken balance and
 * underlying value back from the vault, the live on-chain state a
 * deposit's confirmation is judged against, never DeFindex's own
 * cached notion of "did the deposit succeed".
 */
export async function getDepositorVaultBalance(
  vaultAddress: string,
  depositorAddress: string
): Promise<{ dfTokens: number; underlyingBalance: number[] }> {
  try {
    return await getSdk().getVaultBalance(vaultAddress, depositorAddress);
  } catch (cause) {
    throw new VaultBalanceQueryError('Could not read your vault balance. Try again.', { cause });
  }
}
