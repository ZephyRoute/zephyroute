import { Horizon, NotFoundError } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon.stellar.org');

export class HorizonQueryError extends Error {}

export interface AssetIdentifier {
  code: string;
  issuer?: string;
}

/**
 * FR3, Integration Coupling Map: runs before the quote request fires,
 * not after. A brand-new, never-funded account (Horizon 404s it) is
 * treated the same as "no trustline", both route to onboarding (FR6)
 * rather than surfacing an opaque API rejection later.
 */
export async function hasTrustline(
  accountId: string,
  asset: AssetIdentifier
): Promise<boolean> {
  if (!asset.issuer) {
    // Native XLM never needs a trustline.
    return true;
  }

  try {
    const account = await server.loadAccount(accountId);
    return account.balances.some(
      (balance) =>
        'asset_code' in balance &&
        'asset_issuer' in balance &&
        balance.asset_code === asset.code &&
        balance.asset_issuer === asset.issuer
    );
  } catch (cause) {
    if (cause instanceof NotFoundError) {
      return false;
    }
    throw new HorizonQueryError('Could not check your Stellar account. Try again.', { cause });
  }
}
