import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { inspectDepositTransaction, getLedgerTiming, getAssetBalance, submitDepositTransaction, signDepositTransaction } =
  vi.hoisted(() => ({
    inspectDepositTransaction: vi.fn(),
    getLedgerTiming: vi.fn(),
    getAssetBalance: vi.fn(),
    submitDepositTransaction: vi.fn(),
    signDepositTransaction: vi.fn(),
  }));

vi.mock('@/lib/deposit-xdr-inspector', () => ({ inspectDepositTransaction }));
vi.mock('@/lib/horizon', () => ({ getLedgerTiming, getAssetBalance, submitDepositTransaction }));
vi.mock('@/lib/wallet-kit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wallet-kit')>('@/lib/wallet-kit');
  return { ...actual, signDepositTransaction };
});

const { useDepositSigning } = await import('./useDepositSigning');
const { DepositSigningError } = await import('@/lib/wallet-kit');

const VALID_XDR = 'AAAAAgAAAAB' + 'A'.repeat(50);
const PARAMS = { depositorAddress: 'GDEPOSITOR', amountInSmallestUnits: '10000000', slippageBps: 100 };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Real fetch calls now fan out across three routes (build, balance,
 * correlation); a single blanket mock response would silently feed
 * the wrong shape to each caller, so this differentiates by URL like
 * the real routes actually do.
 */
function mockRoutedFetch({
  dfTokens = 0,
  correlationOk = true,
}: { dfTokens?: number; correlationOk?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/deposit/build')) {
        return Promise.resolve(jsonResponse(200, { xdr: VALID_XDR, vaultAddress: 'CVAULT' }));
      }
      if (url.includes('/api/deposit/balance')) {
        return Promise.resolve(jsonResponse(200, { dfTokens, underlyingBalance: [] }));
      }
      if (url.includes('/api/correlation')) {
        return Promise.resolve(jsonResponse(correlationOk ? 200 : 502, { ok: correlationOk }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

function mockHealthyBuild() {
  mockRoutedFetch();
  inspectDepositTransaction.mockReturnValue({ signatureExpirationLedger: 1010, feeStroops: '100000' });
  getLedgerTiming.mockResolvedValue({
    currentLedgerSeq: 1000,
    currentLedgerCloseMs: Date.parse('2026-09-22T00:00:00Z'),
    ledgerCloseIntervalMs: 5000,
  });
  getAssetBalance.mockResolvedValue({ balance: '50.0000000', lastModifiedTime: '2026-09-22T00:00:00Z' });
}

describe('useDepositSigning', () => {
  const signMessage = vi.fn().mockResolvedValue('c2ln');

  beforeEach(() => {
    vi.clearAllMocks();
    signMessage.mockResolvedValue('c2ln');
    vi.setSystemTime(Date.parse('2026-09-22T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reaches ready-to-sign with the vault, minimum-guaranteed amount, and a countdown when the fee is affordable', async () => {
    mockHealthyBuild();
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });

    await waitFor(() => expect(result.current.status).toBe('ready-to-sign'));
    expect(result.current.vaultAddress).toBe('CVAULT');
    expect(result.current.amountInSmallestUnits).toBe('10000000');
    expect(result.current.minimumGuaranteedInSmallestUnits).toBe('9900000');
    expect(result.current.secondsRemaining).toBeGreaterThan(0);
    // Security review finding: inspected against the real requested
    // vault and this depositor's own address, not just parsed blindly.
    expect(inspectDepositTransaction).toHaveBeenCalledWith(VALID_XDR, {
      vaultAddress: 'CVAULT',
      depositorAddress: 'GDEPOSITOR',
    });
  });

  it('stops at insufficient-fee before ever reaching a signature prompt, per AC #4', async () => {
    mockHealthyBuild();
    getAssetBalance.mockResolvedValue({ balance: '0.0000001', lastModifiedTime: '2026-09-22T00:00:00Z' });
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });

    await waitFor(() => expect(result.current.status).toBe('insufficient-fee'));
    expect(result.current.requiredFeeXLM).toBe('0.01');
  });

  it('surfaces a build failure as failed, never a silent hang', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(502, { error: { code: 'DEPOSIT_BUILD_FAILED', message: 'DeFindex is unavailable.' } })
      )
    );
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.errorMessage).toBe('DeFindex is unavailable.');
    });
  });

  it('moves through submitted then confirming on-chain, never collapsing the two states, per AC #1', async () => {
    mockHealthyBuild();
    signDepositTransaction.mockResolvedValue('AAAASIGNED');
    submitDepositTransaction.mockResolvedValue({ hash: 'DEADBEEF', successful: true });
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });
    await waitFor(() => expect(result.current.status).toBe('ready-to-sign'));

    await act(async () => {
      await result.current.sign(signMessage);
    });

    expect(result.current.txHash).toBe('DEADBEEF');
    await waitFor(() => expect(result.current.status).toBe('confirming on-chain'));
  });

  it('reaches completed once the dfToken balance increases over the pre-deposit baseline, per AC #2', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let dfTokens = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/deposit/build')) {
          return Promise.resolve(jsonResponse(200, { xdr: VALID_XDR, vaultAddress: 'CVAULT' }));
        }
        if (url.includes('/api/deposit/balance')) {
          return Promise.resolve(jsonResponse(200, { dfTokens, underlyingBalance: [] }));
        }
        return Promise.resolve(jsonResponse(200, { ok: true }));
      })
    );
    inspectDepositTransaction.mockReturnValue({ signatureExpirationLedger: 1010, feeStroops: '100000' });
    getLedgerTiming.mockResolvedValue({
      currentLedgerSeq: 1000,
      currentLedgerCloseMs: Date.parse('2026-09-22T00:00:00Z'),
      ledgerCloseIntervalMs: 5000,
    });
    getAssetBalance.mockResolvedValue({ balance: '50.0000000', lastModifiedTime: '2026-09-22T00:00:00Z' });
    signDepositTransaction.mockResolvedValue('AAAASIGNED');
    submitDepositTransaction.mockResolvedValue({ hash: 'DEADBEEF', successful: true });
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });
    await waitFor(() => expect(result.current.status).toBe('ready-to-sign'));
    await act(async () => {
      await result.current.sign(signMessage);
    });

    expect(result.current.status).toBe('confirming on-chain');

    // The balance now reflects the confirmed deposit, above the
    // baseline of 0 captured before signing.
    dfTokens = 100;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.dfTokens).toBe(100);

    // Security review finding: the deposit-completion write now also
    // requires a signed correlation write-proof, not an open write.
    expect(signMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^zephyroute:correlation-write:\d+$/)
    );
    const patchCall = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
    const patchBody = JSON.parse((patchCall?.[1] as RequestInit).body as string);
    expect(patchBody.signature).toBe('c2ln');
    expect(patchBody.message).toMatch(/^zephyroute:correlation-write:\d+$/);
  });

  it('reports an explicit reverted state, distinct from a submission failure, per AC #3', async () => {
    mockHealthyBuild();
    signDepositTransaction.mockResolvedValue('AAAASIGNED');
    submitDepositTransaction.mockResolvedValue({ hash: 'DEADBEEF', successful: false });
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });
    await waitFor(() => expect(result.current.status).toBe('ready-to-sign'));

    await act(async () => {
      await result.current.sign(signMessage);
    });

    await waitFor(() => expect(result.current.status).toBe('reverted'));
  });

  it('reports an explicit disconnected state, never assuming success, per AC #3', async () => {
    mockHealthyBuild();
    signDepositTransaction.mockRejectedValue(
      new DepositSigningError('Wallet disconnected before the signature completed.', 'disconnected')
    );
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });
    await waitFor(() => expect(result.current.status).toBe('ready-to-sign'));

    await act(async () => {
      await result.current.sign(signMessage);
    });

    await waitFor(() => expect(result.current.status).toBe('disconnected'));
    expect(submitDepositTransaction).not.toHaveBeenCalled();
  });

  it('auto-rebuilds when a resync finds the window already expired, per AC #2', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockHealthyBuild();
    const { result } = renderHook(() => useDepositSigning());

    await act(async () => {
      await result.current.start(PARAMS);
    });
    await waitFor(() => expect(result.current.status).toBe('ready-to-sign'));

    // The next resync sees the window has expired.
    getLedgerTiming.mockResolvedValue({
      currentLedgerSeq: 1010,
      currentLedgerCloseMs: Date.parse('2026-09-22T00:00:50Z'),
      ledgerCloseIntervalMs: 5000,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(result.current.rebuildAnnouncement).toBeTruthy();
  });
});
