import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { createPasskeyCredential, signWithPasskey } = vi.hoisted(() => ({
  createPasskeyCredential: vi.fn(),
  signWithPasskey: vi.fn(),
}));

vi.mock('@/lib/dfns-passkey', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-passkey')>('@/lib/dfns-passkey');
  return { ...actual, createPasskeyCredential, signWithPasskey };
});

const { useEmbeddedWalletOnboarding } = await import('./useEmbeddedWalletOnboarding');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockRoutedFetch(overrides: Partial<Record<string, unknown>> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/register/challenge')) {
        return Promise.resolve(jsonResponse(200, overrides.registerChallenge ?? { challengeIdentifier: 'reg-ci' }));
      }
      if (url.includes('/register/complete')) {
        return Promise.resolve(
          jsonResponse(
            200,
            overrides.registerComplete ?? {
              userId: 'u1',
              walletId: 'w1',
              stellarAddress: 'GNEWACCOUNT',
              registrationToken: 'reg-token-1',
            }
          )
        );
      }
      if (url.includes('/fund/build')) {
        return Promise.resolve(
          jsonResponse(
            200,
            overrides.fundBuild ?? { partiallySignedXdr: 'AAAAAgAAAAB', hashHex: 'ab'.repeat(32) }
          )
        );
      }
      if (url.includes('/fund/sign-init')) {
        return Promise.resolve(
          jsonResponse(200, overrides.signInit ?? { challengeIdentifier: 'sign-ci' })
        );
      }
      if (url.includes('/fund/sign-complete')) {
        return Promise.resolve(
          jsonResponse(200, overrides.signComplete ?? { hash: 'DEADBEEF', successful: true })
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

describe('useEmbeddedWalletOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPasskeyCredential.mockResolvedValue({
      credentialKind: 'Fido2',
      credentialInfo: { credId: 'c1', clientData: 'cd', attestationData: 'ad' },
    });
    signWithPasskey.mockResolvedValue({
      kind: 'Fido2',
      credentialAssertion: { credId: 'c1', clientData: 'cd', authenticatorData: 'ad', signature: 'sig' },
    });
  });

  it('completes the full flow end to end and returns the new Stellar address (AC #1/#3)', async () => {
    mockRoutedFetch();
    const { result } = renderHook(() => useEmbeddedWalletOnboarding());

    let address: string | null = null;
    await act(async () => {
      address = await result.current.onboard('user@example.com', { code: 'USDC', issuer: 'GISSUER' });
    });

    expect(address).toBe('GNEWACCOUNT');
    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.stellarAddress).toBe('GNEWACCOUNT');
      expect(result.current.walletId).toBe('w1');
    });
    expect(createPasskeyCredential).toHaveBeenCalledOnce();
    expect(signWithPasskey).toHaveBeenCalledOnce();

    const fundBuildCall = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => input.toString().includes('/fund/build'));
    const fundBuildBody = JSON.parse((fundBuildCall?.[1] as RequestInit).body as string);
    expect(fundBuildBody.registrationToken).toBe('reg-token-1');
  });

  it('never reaches funding at all if passkey registration fails', async () => {
    mockRoutedFetch();
    createPasskeyCredential.mockRejectedValue(new Error('User declined the passkey prompt'));
    const { result } = renderHook(() => useEmbeddedWalletOnboarding());

    await act(async () => {
      await result.current.onboard('user@example.com', { code: 'XLM' });
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/fund/build'),
      expect.anything()
    );
  });

  it('reports failed, never completed, when the final submission is rejected on-chain', async () => {
    mockRoutedFetch({ signComplete: { hash: 'DEADBEEF', successful: false } });
    const { result } = renderHook(() => useEmbeddedWalletOnboarding());

    await act(async () => {
      await result.current.onboard('user@example.com', { code: 'XLM' });
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.stellarAddress).toBeNull();
  });

  it('sets providerUnavailable only for ONBOARDING_NOT_CONFIGURED, never an ordinary failure, per Story 2.3', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(503, { error: { code: 'ONBOARDING_NOT_CONFIGURED', message: 'Account setup is not available yet.' } })
      )
    );
    const { result } = renderHook(() => useEmbeddedWalletOnboarding());

    await act(async () => {
      await result.current.onboard('user@example.com', { code: 'XLM' });
    });

    await waitFor(() => expect(result.current.providerUnavailable).toBe(true));
  });

  it('never sets providerUnavailable for an ordinary per-user failure', async () => {
    mockRoutedFetch();
    createPasskeyCredential.mockRejectedValue(new Error('User declined the passkey prompt'));
    const { result } = renderHook(() => useEmbeddedWalletOnboarding());

    await act(async () => {
      await result.current.onboard('user@example.com', { code: 'XLM' });
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.providerUnavailable).toBe(false);
  });
});
