import { Horizon, NotFoundError, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

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

export interface AssetBalance {
  balance: string;
  lastModifiedTime: string;
}

/**
 * FR4: settlement detection is based on the user's actual Stellar
 * account balance via Horizon, never solely on 1Click's own status
 * field. `lastModifiedTime` is Horizon's own ledger-close timestamp,
 * used for the Step Tracker's completion time (Independent
 * auditability), never the client's local clock.
 */
export async function getAssetBalance(
  accountId: string,
  asset: AssetIdentifier
): Promise<AssetBalance | null> {
  try {
    const account = await server.loadAccount(accountId);
    const line = asset.issuer
      ? account.balances.find(
          (balance) =>
            'asset_code' in balance &&
            'asset_issuer' in balance &&
            balance.asset_code === asset.code &&
            balance.asset_issuer === asset.issuer
        )
      : account.balances.find((balance) => balance.asset_type === 'native');

    if (!line) return null;
    return { balance: line.balance, lastModifiedTime: account.last_modified_time };
  } catch (cause) {
    if (cause instanceof NotFoundError) {
      return null;
    }
    throw new HorizonQueryError('Could not check your Stellar account. Try again.', { cause });
  }
}

export interface LedgerTiming {
  currentLedgerSeq: number;
  currentLedgerCloseMs: number;
  ledgerCloseIntervalMs: number;
}

/**
 * Story 1.10, AC #1: the signature-window countdown must derive its
 * remaining time from the server-issued authorization window expiry,
 * not the client's local clock. The close interval used to project a
 * future ledger's timestamp is read from the two most recent real
 * ledgers rather than assumed, so it reflects the network's actual
 * current cadence.
 */
export async function getLedgerTiming(): Promise<LedgerTiming> {
  let page;
  try {
    page = await server.ledgers().order('desc').limit(2).call();
  } catch (cause) {
    throw new HorizonQueryError("Could not read the network's current ledger. Try again.", {
      cause,
    });
  }

  const [latest, previous] = page.records;
  if (!latest || !previous) {
    throw new HorizonQueryError('Not enough ledger history to time the signature window.');
  }

  return {
    currentLedgerSeq: latest.sequence,
    currentLedgerCloseMs: new Date(latest.closed_at).getTime(),
    ledgerCloseIntervalMs: new Date(latest.closed_at).getTime() - new Date(previous.closed_at).getTime(),
  };
}

export class TransactionSubmissionError extends Error {}

export interface SubmittedTransaction {
  hash: string;
  successful: boolean;
}

/**
 * Story 1.10 ("Sign and Submit"): broadcasts the signed deposit XDR.
 * On-chain confirmation polling (the `submitted`/`confirming` states
 * and revert detection) is Story 1.11's job, this only gets the
 * transaction onto the network and reports whether Horizon accepted
 * it, never silently swallowing a rejection.
 */
export async function submitDepositTransaction(signedXdr: string): Promise<SubmittedTransaction> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC);
  try {
    const response = await server.submitTransaction(transaction);
    return { hash: response.hash, successful: response.successful };
  } catch (cause) {
    throw new TransactionSubmissionError('Could not submit the deposit transaction. Try again.', {
      cause,
    });
  }
}
