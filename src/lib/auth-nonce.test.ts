import { describe, expect, it, vi, afterEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import {
  buildCorrelationReadChallenge,
  verifyCorrelationReadProof,
  InvalidProofError,
} from './auth-nonce';

function sign(keypair: Keypair, message: string): string {
  return Buffer.from(keypair.signMessage(message)).toString('base64');
}

describe('buildCorrelationReadChallenge', () => {
  it('produces the exact fixed challenge format with the current unix timestamp', () => {
    const fixedDate = new Date('2026-09-22T00:00:00Z');
    vi.setSystemTime(fixedDate);
    const expectedTimestamp = Math.floor(fixedDate.getTime() / 1000);
    expect(buildCorrelationReadChallenge()).toBe(`zephyroute:correlation-read:${expectedTimestamp}`);
    vi.useRealTimers();
  });
});

describe('verifyCorrelationReadProof', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a real SEP-53 signature over the exact fixed challenge, from the real SDK, no mocking', () => {
    const keypair = Keypair.random();
    const message = buildCorrelationReadChallenge();
    const signature = sign(keypair, message);

    expect(() => verifyCorrelationReadProof(keypair.publicKey(), message, signature)).not.toThrow();
  });

  it('rejects a signature from a different address than the one claimed, closing the enumeration gap (AC #1)', () => {
    const signer = Keypair.random();
    const claimedAddress = Keypair.random().publicKey();
    const message = buildCorrelationReadChallenge();
    const signature = sign(signer, message);

    expect(() => verifyCorrelationReadProof(claimedAddress, message, signature)).toThrow(
      InvalidProofError
    );
  });

  it('rejects a challenge string that does not match the fixed format, never an open lookup', () => {
    const keypair = Keypair.random();
    const forged = 'zephyroute:correlation-read:not-a-timestamp';

    expect(() =>
      verifyCorrelationReadProof(keypair.publicKey(), forged, 'irrelevant')
    ).toThrow(InvalidProofError);
  });

  it('rejects a stale challenge outside the clock-skew window, refusing a replayed old signature', () => {
    const keypair = Keypair.random();
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const message = `zephyroute:correlation-read:${staleTimestamp}`;
    const signature = sign(keypair, message);

    expect(() => verifyCorrelationReadProof(keypair.publicKey(), message, signature)).toThrow(
      InvalidProofError
    );
  });

  it('rejects a tampered signature that does not verify against the message', () => {
    const keypair = Keypair.random();
    const message = buildCorrelationReadChallenge();

    expect(() =>
      verifyCorrelationReadProof(keypair.publicKey(), message, Buffer.alloc(64).toString('base64'))
    ).toThrow(InvalidProofError);
  });
});
