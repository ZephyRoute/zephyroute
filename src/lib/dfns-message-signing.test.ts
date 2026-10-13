// @vitest-environment node
//
// jsdom does not implement `crypto.subtle` (a real, known jsdom gap,
// not this project's assumption), and this module's SEP-53 hashing
// needs it. This module has no DOM/React dependency, so the real Node
// environment (which does implement Web Crypto natively) is correct
// here regardless, the same fix already applied to
// `solana-swap.test.ts` for an unrelated jsdom incompatibility.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';

const { signWithPasskey } = vi.hoisted(() => ({ signWithPasskey: vi.fn() }));

vi.mock('@/lib/dfns-passkey', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dfns-passkey')>('@/lib/dfns-passkey');
  return { ...actual, signWithPasskey };
});

const { signMessageWithDfns, DfnsMessageSigningError } = await import('./dfns-message-signing');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('signMessageWithDfns (security review follow-on: DFNS write/read-proof signing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signWithPasskey.mockResolvedValue({
      kind: 'Fido2',
      credentialAssertion: { credId: 'c1', clientData: 'cd', authenticatorData: 'ad', signature: 'sig' },
    });
  });

  it(
    'produces a signature that Keypair.verifyMessage genuinely accepts for the real address, not just a ' +
      'plausible-looking string (proves the SEP-53 hash construction is correct, not assumed)',
    async () => {
      const keypair = Keypair.random();
      const message = 'zephyroute:correlation-write:1758499200';
      // The DFNS wallet's MPC key IS this keypair for the purpose of
      // this test: sign-complete returns a real signature over
      // whatever hash sign-init/sign-complete were asked to sign,
      // exactly as DFNS's own 'kind: Hash' signing would.
      let requestedHashHex = '';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString();
          const body = JSON.parse(init!.body as string);
          if (url.includes('/sign-init')) {
            requestedHashHex = body.hashHex;
            return Promise.resolve(jsonResponse(200, { challengeIdentifier: 'ci' }));
          }
          if (url.includes('/sign-complete')) {
            const hash = Buffer.from(requestedHashHex, 'hex');
            const signature = keypair.sign(hash);
            return Promise.resolve(
              jsonResponse(200, { signature: Buffer.from(signature).toString('base64') })
            );
          }
          throw new Error(`Unexpected fetch: ${url}`);
        })
      );

      const signature = await signMessageWithDfns('w1', message);

      const verified = keypair.verifyMessage(message, Buffer.from(signature, 'base64'));
      expect(verified).toBe(true);
    }
  );

  it('signs the sep-53 challenge via the passkey before ever calling sign-complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/sign-init')) return Promise.resolve(jsonResponse(200, { challengeIdentifier: 'ci' }));
        if (url.includes('/sign-complete')) return Promise.resolve(jsonResponse(200, { signature: 'c2ln' }));
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await signMessageWithDfns('w1', 'zephyroute:correlation-read:1758499200');

    expect(signWithPasskey).toHaveBeenCalledOnce();
  });

  it('wraps a declined or failed passkey ceremony in DfnsMessageSigningError, never a silent failure', async () => {
    const { PasskeyError } = await import('@/lib/dfns-passkey');
    signWithPasskey.mockRejectedValue(new PasskeyError('User declined the passkey prompt'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { challengeIdentifier: 'ci' }))
    );

    await expect(signMessageWithDfns('w1', 'zephyroute:correlation-read:1')).rejects.toBeInstanceOf(
      DfnsMessageSigningError
    );
  });

  it('surfaces a sign-complete failure explicitly, never a silent hang', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/sign-init')) return Promise.resolve(jsonResponse(200, { challengeIdentifier: 'ci' }));
        return Promise.resolve(
          jsonResponse(502, { error: { code: 'MESSAGE_SIGNING_COMPLETE_FAILED', message: 'DFNS unreachable.' } })
        );
      })
    );

    await expect(signMessageWithDfns('w1', 'zephyroute:correlation-read:1')).rejects.toBeInstanceOf(
      DfnsMessageSigningError
    );
  });
});
