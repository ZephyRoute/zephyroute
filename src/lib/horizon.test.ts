import { describe, expect, it, vi, beforeEach } from 'vitest';

const { loadAccount, ledgersCall, submitTransaction } = vi.hoisted(() => ({
  loadAccount: vi.fn(),
  ledgersCall: vi.fn(),
  submitTransaction: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>(
    '@stellar/stellar-sdk'
  );
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: class {
        loadAccount = loadAccount;
        submitTransaction = submitTransaction;
        ledgers() {
          return { order: () => ({ limit: () => ({ call: ledgersCall }) }) };
        }
      },
    },
  };
});

import {
  hasTrustline,
  getAssetBalance,
  getLedgerTiming,
  submitDepositTransaction,
  HorizonQueryError,
  TransactionSubmissionError,
} from './horizon';
import {
  NotFoundError,
  Account,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Keypair,
} from '@stellar/stellar-sdk';

function buildTestXDR(): string {
  const account = new Account(Keypair.random().publicKey(), '1');
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
    .setTimeout(30)
    .build()
    .toXDR();
}

describe('hasTrustline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is always true for native XLM, which never needs a trustline', async () => {
    const result = await hasTrustline('GABCDEF', { code: 'XLM' });

    expect(result).toBe(true);
    expect(loadAccount).not.toHaveBeenCalled();
  });

  it('returns true when a matching asset_code/asset_issuer balance line exists', async () => {
    loadAccount.mockResolvedValue({
      balances: [
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER' },
      ],
    });

    const result = await hasTrustline('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });

    expect(result).toBe(true);
  });

  it('returns false when the account exists but has no matching trustline', async () => {
    loadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native' }],
    });

    const result = await hasTrustline('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });

    expect(result).toBe(false);
  });

  it('treats a brand-new, never-funded account (404) the same as no trustline, routing to onboarding', async () => {
    loadAccount.mockRejectedValue(new NotFoundError('Account not found', {} as never));

    const result = await hasTrustline('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });

    expect(result).toBe(false);
  });

  it('surfaces a real Horizon outage explicitly, never a silent failure', async () => {
    loadAccount.mockRejectedValue(new Error('network error'));

    await expect(hasTrustline('GABCDEF', { code: 'USDC', issuer: 'GISSUER' })).rejects.toBeInstanceOf(
      HorizonQueryError
    );
  });
});

describe('getAssetBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the balance and Horizon ledger-close timestamp, never the local clock, for a matching asset', async () => {
    loadAccount.mockResolvedValue({
      last_modified_time: '2026-09-21T12:00:00Z',
      balances: [
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '9.969' },
      ],
    });

    const result = await getAssetBalance('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });

    expect(result).toEqual({ balance: '9.969', lastModifiedTime: '2026-09-21T12:00:00Z' });
  });

  it('returns null when the account exists but the asset line is not found (FR4: based on the real balance, not assumed)', async () => {
    loadAccount.mockResolvedValue({ last_modified_time: '2026-09-21T12:00:00Z', balances: [] });

    const result = await getAssetBalance('GABCDEF', { code: 'USDC', issuer: 'GISSUER' });

    expect(result).toBeNull();
  });

  it('returns null for a not-yet-existing account rather than throwing', async () => {
    loadAccount.mockRejectedValue(new NotFoundError('Account not found', {} as never));

    const result = await getAssetBalance('GABCDEF', { code: 'XLM' });

    expect(result).toBeNull();
  });
});

describe('getLedgerTiming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives the close interval from the two most recent real ledgers, never a hardcoded guess', async () => {
    ledgersCall.mockResolvedValue({
      records: [
        { sequence: 1000, closed_at: '2026-09-21T12:00:10Z' },
        { sequence: 999, closed_at: '2026-09-21T12:00:05Z' },
      ],
    });

    const result = await getLedgerTiming();

    expect(result).toEqual({
      currentLedgerSeq: 1000,
      currentLedgerCloseMs: new Date('2026-09-21T12:00:10Z').getTime(),
      ledgerCloseIntervalMs: 5000,
    });
  });

  it('surfaces a Horizon outage explicitly rather than silently failing', async () => {
    ledgersCall.mockRejectedValue(new Error('network error'));

    await expect(getLedgerTiming()).rejects.toBeInstanceOf(HorizonQueryError);
  });

  it('refuses to time the window from a single ledger of history', async () => {
    ledgersCall.mockResolvedValue({ records: [{ sequence: 1000, closed_at: '2026-09-21T12:00:10Z' }] });

    await expect(getLedgerTiming()).rejects.toBeInstanceOf(HorizonQueryError);
  });
});

describe('submitDepositTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the parsed transaction and returns its hash and success flag', async () => {
    submitTransaction.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    const result = await submitDepositTransaction(buildTestXDR());

    expect(result).toEqual({ hash: 'DEADBEEF', successful: true });
    expect(submitTransaction).toHaveBeenCalledOnce();
  });

  it('wraps a rejected submission as TransactionSubmissionError, never a silent failure', async () => {
    submitTransaction.mockRejectedValue(new Error('tx_bad_seq'));

    await expect(submitDepositTransaction(buildTestXDR())).rejects.toBeInstanceOf(
      TransactionSubmissionError
    );
  });
});
