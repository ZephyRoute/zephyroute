import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Account, Address, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';

const { completeWalletSignature, waitForWalletSignature, attachDepositorSignatureAndSubmit } =
  vi.hoisted(() => ({
    completeWalletSignature: vi.fn(),
    waitForWalletSignature: vi.fn(),
    attachDepositorSignatureAndSubmit: vi.fn(),
  }));

vi.mock('@/lib/dfns-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-client')>('@/lib/dfns-client');
  return { ...actual, completeWalletSignature, waitForWalletSignature };
});
vi.mock('@/lib/deposit-dfns-signing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/deposit-dfns-signing')>(
    '@/lib/deposit-dfns-signing'
  );
  return { ...actual, attachDepositorSignatureAndSubmit };
});

const { POST } = await import('./route');

/**
 * A real, well-formed deposit transaction, the same fixture shape
 * `deposit-xdr-inspector.test.ts` already uses, not a placeholder
 * string: the sign-complete route now parses and inspects the XDR for
 * real (security review finding), so a fake XDR would fail before ever
 * reaching the behavior these tests exercise.
 */
function buildDepositFixture() {
  const source = Keypair.random();
  const depositor = Keypair.random().publicKey();
  const vault = Address.contract(new Uint8Array(32)).toString();
  const account = new Account(source.publicKey(), '1');

  const authEntry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(depositor).toScAddress(),
        nonce: BigInt(1),
        signatureExpirationLedger: 100,
        signature: xdr.ScVal.scvVoid(),
      })
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(depositor).toScAddress(),
          functionName: 'deposit',
          args: [],
        })
      ),
      subInvocations: [],
    }),
  });

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  }).addOperation(
    Operation.invokeContractFunction({
      contract: vault,
      function: 'deposit',
      args: [],
      auth: [authEntry],
    })
  );
  builder.setTimeout(30);
  const transaction = builder.build();
  const hashHex = Buffer.from(transaction.hash()).toString('hex');

  return { unsignedXdr: transaction.toXDR(), hashHex, vault, depositor };
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/deposit/sign-complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/deposit/sign-complete', () => {
  const originalVault = process.env.DEFINDEX_VAULT_ADDRESS;

  beforeEach(() => {
    vi.clearAllMocks();
    completeWalletSignature.mockResolvedValue({ id: 'sig1', status: 'Pending' });
  });

  afterEach(() => {
    if (originalVault === undefined) delete process.env.DEFINDEX_VAULT_ADDRESS;
    else process.env.DEFINDEX_VAULT_ADDRESS = originalVault;
  });

  it('rejects a body missing required fields with a 400, never reaching DFNS', async () => {
    const response = await POST(postRequest({ walletId: 'w1' }));

    expect(response.status).toBe(400);
    expect(completeWalletSignature).not.toHaveBeenCalled();
  });

  it('waits for the signature, extracts it, attaches to the unsigned deposit XDR, and submits (happy path)', async () => {
    const fixture = buildDepositFixture();
    process.env.DEFINDEX_VAULT_ADDRESS = fixture.vault;
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });
    attachDepositorSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

    const response = await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        unsignedXdr: fixture.unsignedXdr,
        depositorAddress: fixture.depositor,
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ hash: 'DEADBEEF', successful: true });
    expect(attachDepositorSignatureAndSubmit).toHaveBeenCalledWith(
      fixture.unsignedXdr,
      fixture.depositor,
      new Uint8Array(Buffer.from('ab'.repeat(64), 'hex'))
    );
  });

  it('reports an on-chain revert as a successful HTTP response with successful: false, never a false success (Story 1.11 parity)', async () => {
    const fixture = buildDepositFixture();
    process.env.DEFINDEX_VAULT_ADDRESS = fixture.vault;
    waitForWalletSignature.mockResolvedValue({
      status: 'Signed',
      signature: { encoded: 'ab'.repeat(64) },
    });
    attachDepositorSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: false });

    const response = await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        unsignedXdr: fixture.unsignedXdr,
        depositorAddress: fixture.depositor,
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.successful).toBe(false);
  });

  it('reports a 503 with a deposit-specific code when DFNS is not configured', async () => {
    const fixture = buildDepositFixture();
    process.env.DEFINDEX_VAULT_ADDRESS = fixture.vault;
    const { DfnsConfigError } = await import('@/lib/dfns-client');
    completeWalletSignature.mockRejectedValue(new DfnsConfigError('not configured'));

    const response = await POST(
      postRequest({
        walletId: 'w1',
        hashHex: fixture.hashHex,
        signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
        unsignedXdr: fixture.unsignedXdr,
        depositorAddress: fixture.depositor,
      })
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error.code).toBe('DFNS_NOT_CONFIGURED');
  });

  describe('hash cross-check (security review finding)', () => {
    it('refuses to sign when hashHex does not match the XDR\'s real hash, never reaching DFNS', async () => {
      const fixture = buildDepositFixture();
      process.env.DEFINDEX_VAULT_ADDRESS = fixture.vault;

      const response = await POST(
        postRequest({
          walletId: 'w1',
          hashHex: 'ab'.repeat(32),
          signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
          unsignedXdr: fixture.unsignedXdr,
          depositorAddress: fixture.depositor,
        })
      );

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error.code).toBe('DEPOSIT_HASH_MISMATCH');
      expect(completeWalletSignature).not.toHaveBeenCalled();
    });

    it('refuses a transaction targeting a different vault than this server is configured for, never reaching DFNS', async () => {
      const fixture = buildDepositFixture();
      process.env.DEFINDEX_VAULT_ADDRESS = Address.contract(new Uint8Array(32).fill(1)).toString();

      const response = await POST(
        postRequest({
          walletId: 'w1',
          hashHex: fixture.hashHex,
          signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
          unsignedXdr: fixture.unsignedXdr,
          depositorAddress: fixture.depositor,
        })
      );

      expect(response.status).toBe(400);
      expect(completeWalletSignature).not.toHaveBeenCalled();
    });

    it('accepts a hashHex that differs only in letter case from the real hash', async () => {
      const fixture = buildDepositFixture();
      process.env.DEFINDEX_VAULT_ADDRESS = fixture.vault;
      waitForWalletSignature.mockResolvedValue({
        status: 'Signed',
        signature: { encoded: 'ab'.repeat(64) },
      });
      attachDepositorSignatureAndSubmit.mockResolvedValue({ hash: 'DEADBEEF', successful: true });

      const response = await POST(
        postRequest({
          walletId: 'w1',
          hashHex: fixture.hashHex.toUpperCase(),
          signedChallenge: { challengeIdentifier: 'ci', firstFactor: {} },
          unsignedXdr: fixture.unsignedXdr,
          depositorAddress: fixture.depositor,
        })
      );

      expect(response.status).toBe(200);
    });
  });
});
