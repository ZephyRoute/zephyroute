import { describe, expect, it, vi, beforeEach } from 'vitest';

const set = vi.fn();
const get = vi.fn();
const del = vi.fn();

vi.mock('@/lib/redis', () => ({ getRedisClient: () => ({ set, get, del }) }));

const { issueRegistrationToken, consumeRegistrationToken, RegistrationTokenError } = await import(
  './onboarding-registration-token'
);

describe('onboarding-registration-token (security review finding: sponsor-treasury drain)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('issueRegistrationToken', () => {
    it('stores the token bound to the exact address and wallet, with a short TTL', async () => {
      const token = await issueRegistrationToken('GNEWACCOUNT', 'w1');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(set).toHaveBeenCalledWith(
        `onboarding-registration-token:${token}`,
        JSON.stringify({ stellarAddress: 'GNEWACCOUNT', walletId: 'w1' }),
        { ex: 300 }
      );
    });

    it('returns a different token on every call, never reusing one', async () => {
      const first = await issueRegistrationToken('GNEWACCOUNT', 'w1');
      const second = await issueRegistrationToken('GNEWACCOUNT', 'w1');

      expect(first).not.toBe(second);
    });
  });

  describe('consumeRegistrationToken', () => {
    it('accepts a token that matches the address it was issued for, and deletes it (single-use)', async () => {
      get.mockResolvedValue({ stellarAddress: 'GNEWACCOUNT', walletId: 'w1' });

      await consumeRegistrationToken('tok-1', 'GNEWACCOUNT');

      expect(del).toHaveBeenCalledWith('onboarding-registration-token:tok-1');
    });

    it(
      'rejects a token for a different address than claimed, never funding an address the token ' +
        "wasn't actually issued for",
      async () => {
        get.mockResolvedValue({ stellarAddress: 'GLEGITADDRESS', walletId: 'w1' });

        await expect(consumeRegistrationToken('tok-1', 'GATTACKERADDRESS')).rejects.toBeInstanceOf(
          RegistrationTokenError
        );
        expect(del).not.toHaveBeenCalled();
      }
    );

    it('rejects a missing, expired, or already-consumed token, never treating absence as valid', async () => {
      get.mockResolvedValue(null);

      await expect(consumeRegistrationToken('tok-never-issued', 'GNEWACCOUNT')).rejects.toBeInstanceOf(
        RegistrationTokenError
      );
      expect(del).not.toHaveBeenCalled();
    });
  });
});
