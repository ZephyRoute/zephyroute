import { describe, expect, it, vi, beforeEach } from 'vitest';

const set = vi.fn();
const get = vi.fn();

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({ set, get }),
}));

import {
  validateCorrelationRecord,
  writeCorrelationRecord,
  updateCorrelationRecordWithDeposit,
  InvalidCorrelationRecordError,
  CorrelationRecordNotFoundError,
} from './validation';

const validRecord = {
  stellarAddress: 'GABCDEFTESTPUBLICADDRESS',
  originChainAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
  settledAmount: '9969000',
  settledAt: '2026-09-21T12:00:00.000Z',
  integratorId: 'zephyroute',
  correlationId: 'corr-1',
};

describe('validateCorrelationRecord', () => {
  it('accepts a fully populated, correctly shaped record', () => {
    expect(validateCorrelationRecord(validRecord)).toEqual(validRecord);
  });

  it('rejects a record missing any required field, listing exactly which', () => {
    const { settledAt: _settledAt, ...incomplete } = validRecord;
    expect(() => validateCorrelationRecord(incomplete)).toThrow(InvalidCorrelationRecordError);
  });

  it('rejects a stellarAddress that is not a real G-address', () => {
    expect(() =>
      validateCorrelationRecord({ ...validRecord, stellarAddress: '0xnotstellar' })
    ).toThrow(InvalidCorrelationRecordError);
  });

  it('rejects an unparseable settledAt timestamp', () => {
    expect(() => validateCorrelationRecord({ ...validRecord, settledAt: 'not-a-date' })).toThrow(
      InvalidCorrelationRecordError
    );
  });

  it('accepts the optional Story 1.11 deposit fields when present and valid', () => {
    const withDeposit = {
      ...validRecord,
      destinationVault: 'CVAULT',
      depositStatus: 'completed' as const,
      depositConfirmedAt: '2026-09-22T00:00:00.000Z',
    };
    expect(validateCorrelationRecord(withDeposit)).toEqual(withDeposit);
  });

  it('rejects a depositStatus that is not "completed" or "reverted"', () => {
    expect(() =>
      validateCorrelationRecord({ ...validRecord, depositStatus: 'pending' as never })
    ).toThrow(InvalidCorrelationRecordError);
  });
});

describe('writeCorrelationRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never persists an unvalidated record, rejecting before any Redis call', async () => {
    const { settledAt: _settledAt, ...incomplete } = validRecord;
    await expect(writeCorrelationRecord(incomplete)).rejects.toBeInstanceOf(
      InvalidCorrelationRecordError
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('persists a validated record keyed by Stellar address', async () => {
    await writeCorrelationRecord(validRecord);

    expect(set).toHaveBeenCalledWith(
      `correlation:${validRecord.stellarAddress}`,
      JSON.stringify(validRecord)
    );
  });
});

describe('updateCorrelationRecordWithDeposit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses to update a record that was never written, never fabricating one', async () => {
    get.mockResolvedValue(null);

    await expect(
      updateCorrelationRecordWithDeposit(validRecord.stellarAddress, {
        destinationVault: 'CVAULT',
        depositStatus: 'completed',
        depositConfirmedAt: '2026-09-22T00:00:00.000Z',
      })
    ).rejects.toBeInstanceOf(CorrelationRecordNotFoundError);
    expect(set).not.toHaveBeenCalled();
  });

  it('merges the deposit outcome into the existing record and re-validates the whole thing', async () => {
    get.mockResolvedValue(validRecord);

    await updateCorrelationRecordWithDeposit(validRecord.stellarAddress, {
      destinationVault: 'CVAULT',
      depositStatus: 'completed',
      depositConfirmedAt: '2026-09-22T00:00:00.000Z',
    });

    expect(set).toHaveBeenCalledWith(
      `correlation:${validRecord.stellarAddress}`,
      JSON.stringify({
        ...validRecord,
        destinationVault: 'CVAULT',
        depositStatus: 'completed',
        depositConfirmedAt: '2026-09-22T00:00:00.000Z',
      })
    );
  });
});
