import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { loadAccount, submitTransaction } = vi.hoisted(() => ({
  loadAccount: vi.fn(),
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
      },
    },
  };
});

import {
  buildOnboardingTransaction,
  attachSignatureAndSubmit,
  SponsorConfigError,
  OnboardingTransactionError,
} from './onboarding-transaction';
import { Keypair, Networks, TransactionBuilder, NotFoundError } from '@stellar/stellar-sdk';

describe('buildOnboardingTransaction', () => {
  const originalSecret = process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY;
  const sponsor = Keypair.random();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY = sponsor.secret();
  });

  afterEach(() => {
    process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY = originalSecret;
  });

  it('refuses to build at all when the sponsor key is not configured, never guessing one', async () => {
    delete process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY;

    await expect(
      buildOnboardingTransaction(Keypair.random().publicKey(), { code: 'XLM' })
    ).rejects.toBeInstanceOf(SponsorConfigError);
    expect(loadAccount).not.toHaveBeenCalled();
  });

  it('surfaces a not-yet-funded sponsor account explicitly, never a generic failure', async () => {
    loadAccount.mockRejectedValue(new NotFoundError('Account not found', {} as never));

    await expect(
      buildOnboardingTransaction(Keypair.random().publicKey(), { code: 'XLM' })
    ).rejects.toBeInstanceOf(SponsorConfigError);
  });

  it('includes sponsored reserve operations plus changeTrust for a non-native asset, sourced correctly (AC #1)', async () => {
    loadAccount.mockResolvedValue(new (await import('@stellar/stellar-sdk')).Account(sponsor.publicKey(), '1'));
    const newAccount = Keypair.random().publicKey();

    const { partiallySignedXdr, hashHex } = await buildOnboardingTransaction(newAccount, {
      code: 'USDC',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    });

    const parsed = TransactionBuilder.fromXDR(partiallySignedXdr, Networks.PUBLIC);
    if (!('operations' in parsed)) throw new Error('expected a plain Transaction');
    expect(parsed.operations.map((op) => op.type)).toEqual([
      'beginSponsoringFutureReserves',
      'createAccount',
      'changeTrust',
      'endSponsoringFutureReserves',
    ]);
    expect(parsed.operations[1]).toMatchObject({
      destination: newAccount,
      startingBalance: '0.0000000',
    });
    expect(parsed.operations[2].source).toBe(newAccount);
    expect(parsed.operations[3].source).toBe(newAccount);
    // The sponsor's own signature is already attached.
    expect(parsed.signatures).toHaveLength(1);
    expect(hashHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('skips changeTrust entirely for native XLM, which needs no trustline', async () => {
    loadAccount.mockResolvedValue(new (await import('@stellar/stellar-sdk')).Account(sponsor.publicKey(), '1'));

    const { partiallySignedXdr } = await buildOnboardingTransaction(Keypair.random().publicKey(), {
      code: 'XLM',
    });

    const parsed = TransactionBuilder.fromXDR(partiallySignedXdr, Networks.PUBLIC);
    if (!('operations' in parsed)) throw new Error('expected a plain Transaction');
    expect(parsed.operations.map((op) => op.type)).toEqual([
      'beginSponsoringFutureReserves',
      'createAccount',
      'endSponsoringFutureReserves',
    ]);
  });
});

describe('attachSignatureAndSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces a transaction whose new-account signature actually verifies, and submits it', async () => {
    const sponsor = Keypair.random();
    const newAccount = Keypair.random();
    process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY = sponsor.secret();
    loadAccount.mockResolvedValue(new (await import('@stellar/stellar-sdk')).Account(sponsor.publicKey(), '1'));

    const { partiallySignedXdr, hashHex } = await buildOnboardingTransaction(
      newAccount.publicKey(),
      { code: 'XLM' }
    );
    // The real signature DFNS would return for this exact hash.
    const realSignature = newAccount.sign(new Uint8Array(Buffer.from(hashHex, 'hex')));

    submitTransaction.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    const result = await attachSignatureAndSubmit(
      partiallySignedXdr,
      newAccount.publicKey(),
      realSignature
    );

    expect(result).toEqual({ hash: 'DEADBEEF', successful: true });
    const submitted = submitTransaction.mock.calls[0][0];
    expect(submitted.signatures).toHaveLength(2);
    // The attached signature must actually verify against the new
    // account's public key over the real transaction hash, the exact
    // check Horizon itself would perform, not just "a signature is present".
    expect(newAccount.verify(submitted.hash(), submitted.signatures[1].signature)).toBe(true);
  });

  it('wraps a submission failure as OnboardingTransactionError, never a silent failure', async () => {
    const sponsor = Keypair.random();
    const newAccount = Keypair.random();
    process.env.ZEPHYROUTE_SPONSOR_SECRET_KEY = sponsor.secret();
    loadAccount.mockResolvedValue(new (await import('@stellar/stellar-sdk')).Account(sponsor.publicKey(), '1'));
    const { partiallySignedXdr, hashHex } = await buildOnboardingTransaction(
      newAccount.publicKey(),
      { code: 'XLM' }
    );
    submitTransaction.mockRejectedValue(new Error('tx_bad_seq'));

    await expect(
      attachSignatureAndSubmit(
        partiallySignedXdr,
        newAccount.publicKey(),
        newAccount.sign(new Uint8Array(Buffer.from(hashHex, 'hex')))
      )
    ).rejects.toBeInstanceOf(OnboardingTransactionError);
  });
});
