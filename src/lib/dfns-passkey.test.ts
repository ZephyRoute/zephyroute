import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const sign = vi.fn();
const WebAuthnSignerConstructor = vi.fn(function WebAuthnSigner() {
  return { create, sign };
});

vi.mock('@dfns/sdk-browser', () => ({ WebAuthnSigner: WebAuthnSignerConstructor }));

const REQUIRED_ENV = {
  NEXT_PUBLIC_DFNS_RELYING_PARTY_ID: 'zephyroute.app',
  NEXT_PUBLIC_DFNS_RELYING_PARTY_NAME: 'Zephyroute',
};

describe('dfns-passkey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The module caches its signer in a module-level variable; a fresh
    // module registry per test keeps that cache from leaking between
    // tests that assert on whether/how many times it was constructed.
    vi.resetModules();
    Object.assign(process.env, REQUIRED_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(REQUIRED_ENV)) delete process.env[key];
  });

  it(
    'loads @dfns/sdk-browser lazily, only when a passkey operation is actually ' +
      'requested (Issue #25), not eagerly at module import',
    async () => {
      expect(WebAuthnSignerConstructor).not.toHaveBeenCalled();

      const { createPasskeyCredential } = await import('./dfns-passkey');
      create.mockResolvedValue({ credentialId: 'c1' });

      await createPasskeyCredential({} as never);

      expect(WebAuthnSignerConstructor).toHaveBeenCalledWith({
        relyingParty: { id: 'zephyroute.app', name: 'Zephyroute' },
      });
    }
  );

  it('creates the signer only once across repeated calls', async () => {
    const { createPasskeyCredential, signWithPasskey } = await import('./dfns-passkey');
    create.mockResolvedValue({ credentialId: 'c1' });
    sign.mockResolvedValue({ signature: 's1' });

    await createPasskeyCredential({} as never);
    await signWithPasskey({} as never);

    expect(WebAuthnSignerConstructor).toHaveBeenCalledTimes(1);
  });

  it('wraps a create failure in PasskeyError', async () => {
    const { createPasskeyCredential, PasskeyError } = await import('./dfns-passkey');
    create.mockRejectedValue(new Error('user cancelled'));

    await expect(createPasskeyCredential({} as never)).rejects.toBeInstanceOf(PasskeyError);
  });

  it('wraps a sign failure in PasskeyError', async () => {
    const { signWithPasskey, PasskeyError } = await import('./dfns-passkey');
    sign.mockRejectedValue(new Error('user cancelled'));

    await expect(signWithPasskey({} as never)).rejects.toBeInstanceOf(PasskeyError);
  });

  it('throws PasskeyError without ever loading the SDK when the relying party is not configured', async () => {
    delete process.env.NEXT_PUBLIC_DFNS_RELYING_PARTY_ID;
    const { createPasskeyCredential, PasskeyError } = await import('./dfns-passkey');

    await expect(createPasskeyCredential({} as never)).rejects.toBeInstanceOf(PasskeyError);
    expect(WebAuthnSignerConstructor).not.toHaveBeenCalled();
  });
});
