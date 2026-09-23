import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Account, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

const { completeWalletSignature, waitForWalletSignature, attachSignatureAndSubmit } = vi.hoisted(
  () => ({
    completeWalletSignature: vi.fn(),
    waitForWalletSignature: vi.fn(),
    attachSignatureAndSubmit: vi.fn(),
  })
);

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, completeWalletSignature, waitForWalletSignature };
});
vi.mock('@/lib/onboarding-transaction', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding-transaction')>(
    '@/lib/onboarding-transaction'
  );
  return { ...actual, attachSignatureAndSubmit };
});

const { POST } = await import('./route');

/**
 * A real, well-formed sponsor-cosigned onboarding transaction, not a
 * placeholder string: the sign-complete route now parses and hash/
 * source-account-checks the XDR for real (security review finding), so
 * a fake XDR would fail before ever reaching the behavior these tests
 * exercise.
 */
function buildOnboardingFixture() {
  const sponsor = Keypair.random();
  const newAccount = Keypair.random().publicKey();
  const sponsorAccount = new Account(sponsor.publicKey(), '1');

  const builder = new TransactionBuilder(sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.beginSponsoringFutureReserves({
        sponsoredId: newAccount,
        source: sponsor.publicKey(),
      })
    )
    .addOperation(
      Operation.createAccount({ destination: newAccount, startingBalance: '0', source: sponsor.publicKey() })
    )
    .addOperation(Operation.endSponsoringFutureReserves({ source: newAccount }));
  builder.setTimeout(300);
  const transaction = builder.build();
  transaction.sign(sponsor);
  const hashHex = Buffer.from(transaction.hash()).toString('hex');

  return { partiallySignedXdr: transaction.toXDR(), hashHex, stellarAddress: newAccount };
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/fund/sign-complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/fund/sign-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeWalletSignature.mockResolvedValue({ id: 'sig1', status: 'Pending' });
  });

  it('rejects a body missing required fields with a 400, never reaching DFNS', async () => {
    const response = await POST(postRequest({ walletId: 'w1' }));

    expect(response.status).toBe(400);
    expect(completeWalletSignature).not.toHaveBeenCalled();
  });

  it('waits for the signature, extracts the encoded signature, attaches, and submits (happy path)', async () => {
    const fixture = buildOnboardingFixture();
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });
    attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    const response = await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        partiallySignedXdr: fixture.partiallySignedXdr,
        stellarAddress: fixture.stellarAddress,
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ hash: 'DEADBEEF', successful: true });
    expect(attachSignatureAndSubmit).toHaveBeenCalledWith(
      fixture.partiallySignedXdr,
      fixture.stellarAddress,
      new Uint8Array(Buffer.from('ab'.repeat(64), 'hex'))
    );
  });

  it('falls back to concatenated r+s when no encoded signature is present', async () => {
    const fixture = buildOnboardingFixture();
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { r: 'ab'.repeat(32), s: 'cd'.repeat(32) },
    });
    attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        partiallySignedXdr: fixture.partiallySignedXdr,
        stellarAddress: fixture.stellarAddress,
      })
    );

    expect(attachSignatureAndSubmit).toHaveBeenCalledWith(
      fixture.partiallySignedXdr,
      fixture.stellarAddress,
      new Uint8Array(Buffer.from('ab'.repeat(32) + 'cd'.repeat(32), 'hex'))
    );
  });

  it('surfaces a rejected on-chain submission as a 502, never a false success', async () => {
    const fixture = buildOnboardingFixture();
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });
    attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: false });

    const response = await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        partiallySignedXdr: fixture.partiallySignedXdr,
        stellarAddress: fixture.stellarAddress,
      })
    );

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error.code).toBe('ONBOARDING_SUBMISSION_REJECTED');
  });

  it('surfaces a DFNS-reported Failed/Rejected signing as a 502, never a silent hang', async () => {
    const fixture = buildOnboardingFixture();
    const { DfnsRequestError } = await import('@/lib/dfns-client');
    waitForWalletSignature.mockRejectedValue(new DfnsRequestError('DFNS signing failed: policy denied'));

    const response = await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        partiallySignedXdr: fixture.partiallySignedXdr,
        stellarAddress: fixture.stellarAddress,
      })
    );

    expect(response.status).toBe(502);
    expect(attachSignatureAndSubmit).not.toHaveBeenCalled();
  });

  describe('hash/source-account cross-check (security review finding)', () => {
    it('refuses to sign when hashHex does not match the transaction\'s real hash, never reaching DFNS', async () => {
      const fixture = buildOnboardingFixture();

      const response = await POST(
        postRequest({
          walletId: 'w1',
          hashHex: 'ab'.repeat(32),
          signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
          partiallySignedXdr: fixture.partiallySignedXdr,
          stellarAddress: fixture.stellarAddress,
        })
      );

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error.code).toBe('ONBOARDING_HASH_MISMATCH');
      expect(completeWalletSignature).not.toHaveBeenCalled();
    });

    it('refuses when stellarAddress does not match the account this transaction actually creates', async () => {
      const fixture = buildOnboardingFixture();

      const response = await POST(
        postRequest({
          walletId: 'w1',
          hashHex: fixture.hashHex,
          signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
          partiallySignedXdr: fixture.partiallySignedXdr,
          stellarAddress: Keypair.random().publicKey(),
        })
      );

      expect(response.status).toBe(400);
      expect(completeWalletSignature).not.toHaveBeenCalled();
    });

    it('accepts a hashHex that differs only in letter case from the real hash', async () => {
      const fixture = buildOnboardingFixture();
      waitForWalletSignature.mockResolvedValue({
        status: 'Signed',
        signature: { encoded: 'ab'.repeat(64) },
      });
      attachSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

      const response = await POST(
        postRequest({
          walletId: 'w1',
          hashHex: fixture.hashHex.toUpperCase(),
          signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
          partiallySignedXdr: fixture.partiallySignedXdr,
          stellarAddress: fixture.stellarAddress,
        })
      );

      expect(response.status).toBe(200);
    });
  });
});
